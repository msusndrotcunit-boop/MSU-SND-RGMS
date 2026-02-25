import re
from django.core.management.base import BaseCommand
from rgms.models import Cadet


def _sanitize_name(s: str) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    s = s.replace("’", "'").replace("‘", "'").replace("`", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[\x00-\x1F\x7F]", "", s)
    if re.fullmatch(r"[\'\"\\-_.\\s]*", s or ""):
        return ""
    s = re.sub(r"\s{2,}", " ", s)
    return s


class Command(BaseCommand):
    help = "Normalize cadet name fields and fix malformed entries (e.g., single-quote names)"

    def handle(self, *args, **options):
        fixed = 0
        for cadet in Cadet.objects.all():
            orig = (cadet.first_name, cadet.middle_name, cadet.last_name, cadet.suffix_name)
            cadet.first_name = _sanitize_name(cadet.first_name) or (cadet.first_name and "Unknown") or "Unknown"
            cadet.middle_name = _sanitize_name(cadet.middle_name)
            cadet.last_name = _sanitize_name(cadet.last_name) or (cadet.last_name and "Cadet") or "Cadet"
            cadet.suffix_name = _sanitize_name(cadet.suffix_name)
            new = (cadet.first_name, cadet.middle_name, cadet.last_name, cadet.suffix_name)
            if new != orig:
                cadet.save(update_fields=["first_name", "middle_name", "last_name", "suffix_name"])
                fixed += 1
        self.stdout.write(self.style.SUCCESS(f"Normalized names for {fixed} cadet(s)."))
