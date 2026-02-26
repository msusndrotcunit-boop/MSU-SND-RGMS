"""
PDF generation utilities using ReportLab.
"""
import io
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF
from django.utils import timezone

logger = logging.getLogger(__name__)


class PDFGenerator:
    """Base class for PDF generation with common utilities."""
    
    def __init__(self, pagesize=letter):
        self.pagesize = pagesize
        self.buffer = io.BytesIO()
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        self.subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#283593'),
            spaceAfter=20,
            alignment=TA_CENTER
        )
        
        self.section_header_style = ParagraphStyle(
            'SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        
        self.footer_style = ParagraphStyle(
            'Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
    
    def create_document(self, title=None):
        """Create a new PDF document."""
        self.doc = SimpleDocTemplate(
            self.buffer,
            pagesize=self.pagesize,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        self.elements = []
        
        if title:
            self.add_title(title)
    
    def add_title(self, title):
        """Add a title to the document."""
        self.elements.append(Paragraph(title, self.title_style))
        self.elements.append(Spacer(1, 0.2*inch))
    
    def add_subtitle(self, subtitle):
        """Add a subtitle to the document."""
        self.elements.append(Paragraph(subtitle, self.subtitle_style))
        self.elements.append(Spacer(1, 0.1*inch))
    
    def add_section_header(self, header):
        """Add a section header."""
        self.elements.append(Paragraph(header, self.section_header_style))
        self.elements.append(Spacer(1, 0.1*inch))
    
    def add_spacer(self, height=0.2):
        """Add vertical space."""
        self.elements.append(Spacer(1, height*inch))
    
    def add_page_break(self):
        """Add a page break."""
        self.elements.append(PageBreak())
    
    def create_table(self, data, col_widths=None, style=None):
        """Create a formatted table."""
        if style is None:
            style = TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ])
        
        table = Table(data, colWidths=col_widths)
        table.setStyle(style)
        return table
    
    def add_table(self, data, col_widths=None, style=None):
        """Add a table to the document."""
        table = self.create_table(data, col_widths, style)
        self.elements.append(table)
    
    def add_footer(self, text=None):
        """Add a footer with generation timestamp."""
        if text is None:
            text = f"Generated on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
        self.elements.append(Spacer(1, 0.5*inch))
        self.elements.append(Paragraph(text, self.footer_style))
    
    def add_qr_code(self, data, size=2*inch):
        """Add a QR code to the document."""
        qr_code = QrCodeWidget(data)
        bounds = qr_code.getBounds()
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        
        drawing = Drawing(size, size, transform=[size/width, 0, 0, size/height, 0, 0])
        drawing.add(qr_code)
        
        self.elements.append(drawing)
    
    def build(self):
        """Build the PDF and return the buffer."""
        self.doc.build(self.elements)
        self.buffer.seek(0)
        return self.buffer
    
    def get_bytes(self):
        """Get the PDF as bytes."""
        return self.buffer.getvalue()


class CadetProfilePDFGenerator(PDFGenerator):
    """Generate cadet profile PDF reports."""
    
    def generate(self, cadet):
        """Generate a cadet profile PDF."""
        self.create_document("Cadet Profile Report")
        
        # Cadet information section
        self.add_section_header("Personal Information")
        
        personal_data = [
            ['Student ID:', cadet.student_id],
            ['Name:', f"{cadet.first_name} {cadet.middle_name or ''} {cadet.last_name} {cadet.suffix_name or ''}".strip()],
            ['Email:', cadet.email or 'N/A'],
            ['Contact Number:', cadet.contact_number or 'N/A'],
            ['Birthdate:', cadet.birthdate.strftime('%Y-%m-%d') if cadet.birthdate else 'N/A'],
            ['Birthplace:', cadet.birthplace or 'N/A'],
            ['Age:', str(cadet.age) if cadet.age else 'N/A'],
            ['Gender:', cadet.gender or 'N/A'],
            ['Blood Type:', cadet.blood_type or 'N/A'],
            ['Civil Status:', cadet.civil_status or 'N/A'],
            ['Nationality:', cadet.nationality or 'N/A'],
            ['Address:', cadet.address or 'N/A'],
        ]
        
        self.add_table(personal_data, col_widths=[2*inch, 4*inch])
        self.add_spacer()
        
        # Academic information section
        self.add_section_header("Academic Information")
        
        academic_data = [
            ['Company:', cadet.company or 'N/A'],
            ['Platoon:', cadet.platoon or 'N/A'],
            ['Course:', cadet.course or 'N/A'],
            ['Year Level:', str(cadet.year_level) if cadet.year_level else 'N/A'],
            ['Status:', cadet.status],
            ['ROTC Unit:', cadet.rotc_unit or 'N/A'],
            ['Mobilization Center:', cadet.mobilization_center or 'N/A'],
        ]
        
        self.add_table(academic_data, col_widths=[2*inch, 4*inch])
        self.add_spacer()
        
        # Physical information section
        self.add_section_header("Physical Information")
        
        physical_data = [
            ['Height:', cadet.height or 'N/A'],
            ['Weight:', cadet.weight or 'N/A'],
            ['Combat Boots Size:', cadet.combat_boots_size or 'N/A'],
            ['Uniform Size:', cadet.uniform_size or 'N/A'],
            ['Bullcap Size:', cadet.bullcap_size or 'N/A'],
        ]
        
        self.add_table(physical_data, col_widths=[2*inch, 4*inch])
        self.add_spacer()
        
        # Grades information
        if hasattr(cadet, 'grades'):
            self.add_section_header("Academic Performance")
            
            grades_data = [
                ['Metric', 'Value'],
                ['Attendance Present', str(cadet.grades.attendance_present)],
                ['Merit Points', str(cadet.grades.merit_points)],
                ['Demerit Points', str(cadet.grades.demerit_points)],
                ['Prelim Score', str(cadet.grades.prelim_score) if cadet.grades.prelim_score is not None else 'N/A'],
                ['Midterm Score', str(cadet.grades.midterm_score) if cadet.grades.midterm_score is not None else 'N/A'],
                ['Final Score', str(cadet.grades.final_score) if cadet.grades.final_score is not None else 'N/A'],
            ]
            
            self.add_table(grades_data, col_widths=[3*inch, 3*inch])
        
        self.add_footer()
        return self.build()


class GradeReportPDFGenerator(PDFGenerator):
    """Generate grade report PDFs."""
    
    def generate(self, cadets, filters=None):
        """Generate a grades report PDF."""
        title = "Grades Report"
        if filters:
            if filters.get('company'):
                title += f" - Company {filters['company']}"
            if filters.get('platoon'):
                title += f" - Platoon {filters['platoon']}"
        
        self.create_document(title)
        
        # Create grades table
        data = [['Student ID', 'Name', 'Attendance', 'Merit', 'Demerit', 'Prelim', 'Midterm', 'Final']]
        
        for cadet in cadets:
            if hasattr(cadet, 'grades'):
                data.append([
                    cadet.student_id,
                    f"{cadet.first_name} {cadet.last_name}",
                    str(cadet.grades.attendance_present),
                    str(cadet.grades.merit_points),
                    str(cadet.grades.demerit_points),
                    str(cadet.grades.prelim_score) if cadet.grades.prelim_score is not None else '-',
                    str(cadet.grades.midterm_score) if cadet.grades.midterm_score is not None else '-',
                    str(cadet.grades.final_score) if cadet.grades.final_score is not None else '-',
                ])
        
        col_widths = [1*inch, 1.5*inch, 0.8*inch, 0.6*inch, 0.7*inch, 0.6*inch, 0.7*inch, 0.6*inch]
        
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        
        self.add_table(data, col_widths, style)
        self.add_footer()
        
        return self.build()


class AttendanceReportPDFGenerator(PDFGenerator):
    """Generate attendance report PDFs."""
    
    def generate(self, training_days, filters=None):
        """Generate an attendance report PDF."""
        from apps.attendance.models import AttendanceRecord
        from django.db.models import Count, Q
        
        title = "Attendance Report"
        if filters:
            if filters.get('date_from') and filters.get('date_to'):
                title += f" ({filters['date_from']} to {filters['date_to']})"
        
        self.create_document(title)
        
        # Create attendance summary table
        data = [['Date', 'Title', 'Present', 'Absent', 'Late', 'Excused', 'Total']]
        
        for training_day in training_days:
            attendance_stats = AttendanceRecord.objects.filter(training_day=training_day).aggregate(
                present=Count('id', filter=Q(status='present')),
                absent=Count('id', filter=Q(status='absent')),
                late=Count('id', filter=Q(status='late')),
                excused=Count('id', filter=Q(status='excused')),
                total=Count('id')
            )
            
            data.append([
                training_day.date.strftime('%Y-%m-%d'),
                training_day.title[:30],
                str(attendance_stats['present']),
                str(attendance_stats['absent']),
                str(attendance_stats['late']),
                str(attendance_stats['excused']),
                str(attendance_stats['total']),
            ])
        
        col_widths = [1*inch, 2*inch, 0.8*inch, 0.8*inch, 0.6*inch, 0.8*inch, 0.7*inch]
        
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        
        self.add_table(data, col_widths, style)
        self.add_footer()
        
        return self.build()


class CertificatePDFGenerator(PDFGenerator):
    """Generate achievement certificate PDFs."""
    
    def generate(self, activity, cadet_name, verification_code=None):
        """Generate an achievement certificate PDF."""
        self.create_document()
        
        # Certificate border/decoration
        self.add_spacer(0.5)
        
        # Certificate title
        self.elements.append(Paragraph("CERTIFICATE OF ACHIEVEMENT", self.title_style))
        self.add_spacer(0.5)
        
        # Certificate body
        cert_text = f"""
        <para align=center>
        This is to certify that<br/>
        <b><font size=18>{cadet_name}</font></b><br/><br/>
        has successfully participated in<br/>
        <b><font size=14>{activity.title}</font></b><br/><br/>
        held on {activity.date.strftime('%B %d, %Y')}<br/><br/>
        {activity.description[:200] if len(activity.description) <= 200 else activity.description[:197] + '...'}
        </para>
        """
        self.elements.append(Paragraph(cert_text, self.styles['Normal']))
        self.add_spacer(0.8)
        
        # QR code for verification
        if verification_code:
            self.add_qr_code(verification_code, size=1.5*inch)
            self.add_spacer(0.3)
            verification_text = f"<para align=center><font size=8>Verification Code: {verification_code}</font></para>"
            self.elements.append(Paragraph(verification_text, self.styles['Normal']))
            self.add_spacer(0.5)
        else:
            self.add_spacer(1)
        
        # Signature line
        sig_style = ParagraphStyle('Signature', parent=self.styles['Normal'], alignment=TA_CENTER)
        self.elements.append(Paragraph("_________________________", sig_style))
        self.elements.append(Paragraph("Authorized Signature", sig_style))
        
        self.add_footer()
        
        return self.build()
