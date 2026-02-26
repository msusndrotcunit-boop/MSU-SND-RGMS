"""
Management command to keep the service alive by self-pinging.
Can be run as a cron job or scheduled task.
"""
import requests
import time
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Pings the service to keep it alive'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=600,  # 10 minutes
            help='Interval between pings in seconds (default: 600)',
        )
        parser.add_argument(
            '--url',
            type=str,
            default='https://msu-snd-rgms-1.onrender.com/api/health',
            help='URL to ping',
        )
        parser.add_argument(
            '--continuous',
            action='store_true',
            help='Run continuously (for background process)',
        )

    def handle(self, *args, **options):
        interval = options['interval']
        url = options['url']
        continuous = options['continuous']

        if continuous:
            self.stdout.write(self.style.SUCCESS(f'Starting continuous ping every {interval} seconds'))
            while True:
                self.ping_service(url)
                time.sleep(interval)
        else:
            self.ping_service(url)

    def ping_service(self, url):
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                self.stdout.write(self.style.SUCCESS(f'✓ Ping successful: {url}'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠ Ping returned {response.status_code}: {url}'))
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f'✗ Ping failed: {str(e)}'))
