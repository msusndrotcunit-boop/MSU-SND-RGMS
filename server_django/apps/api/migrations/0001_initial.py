from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Cadet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('student_id', models.CharField(max_length=64, unique=True)),
                ('first_name', models.CharField(max_length=128)),
                ('last_name', models.CharField(max_length=128)),
                ('course', models.CharField(blank=True, max_length=16)),
                ('is_profile_completed', models.BooleanField(default=False)),
                ('profile_pic', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Staff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=64, unique=True)),
                ('rank', models.CharField(blank=True, max_length=64)),
                ('first_name', models.CharField(blank=True, max_length=128)),
                ('last_name', models.CharField(blank=True, max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Attendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.IntegerField()),
                ('role', models.CharField(max_length=32)),
                ('day', models.IntegerField()),
                ('status', models.CharField(max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Grade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cadet_id', models.IntegerField()),
                ('final_percent', models.FloatField()),
                ('transmutation', models.CharField(max_length=8)),
                ('passed', models.BooleanField()),
                ('status', models.CharField(default='Completed', max_length=16)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='MeritDemeritLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cadet_id', models.IntegerField()),
                ('issued_by_user_id', models.IntegerField(blank=True, null=True)),
                ('issued_by_name', models.CharField(blank=True, max_length=255)),
                ('points', models.IntegerField()),
                ('type', models.CharField(max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='UserSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email_alerts', models.BooleanField(default=True)),
                ('push_notifications', models.BooleanField(default=True)),
                ('activity_updates', models.BooleanField(default=True)),
                ('dark_mode', models.BooleanField(default=False)),
                ('compact_mode', models.BooleanField(default=False)),
                ('primary_color', models.CharField(default='default', max_length=32)),
                ('custom_bg', models.URLField(blank=True, null=True)),
                ('user', models.OneToOneField(on_delete=models.CASCADE, related_name='settings', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(blank=True, max_length=64)),
                ('message', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('read', models.BooleanField(default=False)),
                ('user', models.ForeignKey(on_delete=models.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AlterUniqueTogether(
            name='attendance',
            unique_together={('user_id', 'role', 'day')},
        ),
        migrations.AlterUniqueTogether(
            name='grade',
            unique_together={('cadet_id',)},
        ),
    ]

