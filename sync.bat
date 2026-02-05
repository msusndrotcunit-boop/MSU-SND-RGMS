@echo off
echo Syncing changes to GitHub...
git add .
git commit -m "auto-sync: %date% %time%"
git push
echo Sync complete!
pause