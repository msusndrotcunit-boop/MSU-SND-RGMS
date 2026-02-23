import json

from django.test import Client, TestCase

from rgms.models import Cadet, MeritDemeritLog


class GradingApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.cadet = Cadet.objects.create(
            student_id="2024-0001",
            first_name="Juan",
            last_name="Dela Cruz",
            is_profile_completed=True,
            attendance_present=12,
            attendance_total=15,
            merit_points=10,
            demerit_points=2,
            prelim_score=85,
            midterm_score=90,
            final_score=95,
        )

    def test_admin_grades_updates_and_transmutates(self):
        payload = {
            "prelimScore": 85,
            "midtermScore": 90,
            "finalScore": 95,
            "attendancePresent": 12,
            "meritPoints": 10,
            "demeritPoints": 2,
            "status": "Ongoing",
        }
        res = self.client.put(
            f"/api/admin/grades/{self.cadet.id}",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.cadet.refresh_from_db()

        expected_subject = ((85 + 90 + 95) / 300) * 40
        expected_attendance = (12 / 15) * 30
        base_aptitude = 100 + 10 - 2
        expected_aptitude = min(max(base_aptitude, 0), 100) * 0.3
        expected_final = expected_subject + expected_attendance + expected_aptitude

        self.assertAlmostEqual(self.cadet.subject_score, expected_subject, places=4)
        self.assertAlmostEqual(self.cadet.attendance_score, expected_attendance, places=4)
        self.assertAlmostEqual(self.cadet.aptitude_score, expected_aptitude, places=4)
        self.assertAlmostEqual(self.cadet.final_grade, expected_final, places=4)
        self.assertEqual(self.cadet.transmuted_grade, "1.50")
        self.assertEqual(self.cadet.grade_remarks, "Passed")

    def test_transmutation_do_status_forces_failed(self):
        payload = {
            "prelimScore": 75,
            "midtermScore": 75,
            "finalScore": 75,
            "attendancePresent": 15,
            "meritPoints": 0,
            "demeritPoints": 0,
            "status": "DO",
        }
        res = self.client.put(
            f"/api/admin/grades/{self.cadet.id}",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.cadet.refresh_from_db()
        self.assertEqual(self.cadet.transmuted_grade, "5.00")
        self.assertEqual(self.cadet.grade_remarks, "Failed")

    def test_merit_logs_update_lifetime_points_and_sync(self):
        payload = {
            "cadetId": self.cadet.id,
            "type": "merit",
            "points": 5,
            "reason": "Test merit",
        }
        res = self.client.post(
            "/api/admin/merit-logs",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)

        MeritDemeritLog.objects.create(
            cadet=self.cadet, type="demerit", points=3, reason="Test demerit"
        )

        sync_res = self.client.post("/api/admin/sync-lifetime-merits")
        self.assertEqual(sync_res.status_code, 200)
        data = sync_res.json()
        self.cadet.refresh_from_db()
        self.assertEqual(self.cadet.merit_points, 5)
        self.assertEqual(self.cadet.demerit_points, 3)
        self.assertEqual(data.get("syncedCount"), 1)
        self.assertEqual(data.get("totalCadets"), 1)
