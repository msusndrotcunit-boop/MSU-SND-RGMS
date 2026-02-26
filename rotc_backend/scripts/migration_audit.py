#!/usr/bin/env python3
"""
Migration audit trail system.
Logs all migration operations with timestamps, user info, and detailed reports.

Usage:
    # Log migration start
    python migration_audit.py --action start --migration-type full --user admin
    
    # Log migration completion
    python migration_audit.py --action complete --migration-id <id> --stats-file summary.json
    
    # View audit log
    python migration_audit.py --action view --limit 10
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

# Add Django project to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from django.db import transaction
from django.contrib.auth import get_user_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Audit log directory
AUDIT_DIR = Path(__file__).parent / 'migration_audits'
AUDIT_DIR.mkdir(exist_ok=True)


class MigrationAudit:
    """Migration audit trail manager."""
    
    def __init__(self):
        self.audit_file = AUDIT_DIR / 'migration_audit_log.jsonl'
        
    def generate_migration_id(self) -> str:
        """Generate unique migration ID."""
        return f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    def log_migration_start(self, migration_type: str, user: str, 
                           description: Optional[str] = None,
                           source_db: Optional[str] = None,
                           target_db: Optional[str] = None,
                           tables: Optional[List[str]] = None) -> str:
        """
        Log migration start.
        
        Args:
            migration_type: Type of migration (full, incremental, test, rollback)
            user: Username performing migration
            description: Optional description
            source_db: Source database identifier
            target_db: Target database identifier
            tables: List of tables being migrated
        
        Returns:
            migration_id: Unique migration identifier
        """
        migration_id = self.generate_migration_id()
        
        log_entry = {
            'migration_id': migration_id,
            'action': 'start',
            'migration_type': migration_type,
            'user': user,
            'description': description,
            'source_db': source_db,
            'target_db': target_db,
            'tables': tables,
            'timestamp': datetime.now().isoformat(),
            'status': 'in_progress'
        }
        
        self._write_log_entry(log_entry)
        logger.info(f"Migration started: {migration_id}")
        
        return migration_id
    
    def log_migration_complete(self, migration_id: str, 
                              stats: Dict[str, Any],
                              success: bool = True,
                              error: Optional[str] = None) -> None:
        """
        Log migration completion.
        
        Args:
            migration_id: Migration identifier
            stats: Migration statistics
            success: Whether migration succeeded
            error: Error message if failed
        """
        log_entry = {
            'migration_id': migration_id,
            'action': 'complete',
            'timestamp': datetime.now().isoformat(),
            'status': 'success' if success else 'failed',
            'stats': stats,
            'error': error
        }
        
        self._write_log_entry(log_entry)
        
        if success:
            logger.info(f"Migration completed successfully: {migration_id}")
        else:
            logger.error(f"Migration failed: {migration_id} - {error}")
    
    def log_migration_rollback(self, migration_id: str, user: str,
                              reason: Optional[str] = None) -> None:
        """
        Log migration rollback.
        
        Args:
            migration_id: Migration identifier to rollback
            user: Username performing rollback
            reason: Reason for rollback
        """
        log_entry = {
            'migration_id': migration_id,
            'action': 'rollback',
            'user': user,
            'reason': reason,
            'timestamp': datetime.now().isoformat(),
            'status': 'rolled_back'
        }
        
        self._write_log_entry(log_entry)
        logger.info(f"Migration rolled back: {migration_id}")
    
    def log_table_migration(self, migration_id: str, table_name: str,
                           records_migrated: int, errors: int = 0) -> None:
        """
        Log individual table migration.
        
        Args:
            migration_id: Migration identifier
            table_name: Name of table migrated
            records_migrated: Number of records migrated
            errors: Number of errors encountered
        """
        log_entry = {
            'migration_id': migration_id,
            'action': 'table_migration',
            'table_name': table_name,
            'records_migrated': records_migrated,
            'errors': errors,
            'timestamp': datetime.now().isoformat()
        }
        
        self._write_log_entry(log_entry)
    
    def log_validation(self, migration_id: str, validation_type: str,
                      passed: bool, details: Optional[Dict[str, Any]] = None) -> None:
        """
        Log validation check.
        
        Args:
            migration_id: Migration identifier
            validation_type: Type of validation (schema, data, integrity)
            passed: Whether validation passed
            details: Validation details
        """
        log_entry = {
            'migration_id': migration_id,
            'action': 'validation',
            'validation_type': validation_type,
            'passed': passed,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        
        self._write_log_entry(log_entry)
    
    def _write_log_entry(self, entry: Dict[str, Any]) -> None:
        """Write log entry to audit file."""
        with open(self.audit_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, default=str) + '\n')
    
    def get_migration_history(self, limit: Optional[int] = None,
                             migration_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get migration history.
        
        Args:
            limit: Maximum number of entries to return
            migration_type: Filter by migration type
        
        Returns:
            List of log entries
        """
        if not self.audit_file.exists():
            return []
        
        entries = []
        with open(self.audit_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    
                    # Apply filters
                    if migration_type and entry.get('migration_type') != migration_type:
                        continue
                    
                    entries.append(entry)
                except json.JSONDecodeError:
                    continue
        
        # Sort by timestamp descending
        entries.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        if limit:
            entries = entries[:limit]
        
        return entries
    
    def get_migration_details(self, migration_id: str) -> List[Dict[str, Any]]:
        """
        Get all log entries for a specific migration.
        
        Args:
            migration_id: Migration identifier
        
        Returns:
            List of log entries for this migration
        """
        if not self.audit_file.exists():
            return []
        
        entries = []
        with open(self.audit_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    if entry.get('migration_id') == migration_id:
                        entries.append(entry)
                except json.JSONDecodeError:
                    continue
        
        # Sort by timestamp
        entries.sort(key=lambda x: x.get('timestamp', ''))
        
        return entries
    
    def generate_migration_report(self, migration_id: str) -> Dict[str, Any]:
        """
        Generate detailed migration report.
        
        Args:
            migration_id: Migration identifier
        
        Returns:
            Migration report
        """
        entries = self.get_migration_details(migration_id)
        
        if not entries:
            return {'error': 'Migration not found'}
        
        # Find start and complete entries
        start_entry = next((e for e in entries if e.get('action') == 'start'), None)
        complete_entry = next((e for e in entries if e.get('action') == 'complete'), None)
        
        # Collect table migrations
        table_migrations = [e for e in entries if e.get('action') == 'table_migration']
        
        # Collect validations
        validations = [e for e in entries if e.get('action') == 'validation']
        
        # Calculate totals
        total_records = sum(t.get('records_migrated', 0) for t in table_migrations)
        total_errors = sum(t.get('errors', 0) for t in table_migrations)
        
        # Calculate duration
        duration = None
        if start_entry and complete_entry:
            start_time = datetime.fromisoformat(start_entry['timestamp'])
            end_time = datetime.fromisoformat(complete_entry['timestamp'])
            duration = (end_time - start_time).total_seconds()
        
        report = {
            'migration_id': migration_id,
            'migration_type': start_entry.get('migration_type') if start_entry else None,
            'user': start_entry.get('user') if start_entry else None,
            'start_time': start_entry.get('timestamp') if start_entry else None,
            'end_time': complete_entry.get('timestamp') if complete_entry else None,
            'duration_seconds': duration,
            'status': complete_entry.get('status') if complete_entry else 'in_progress',
            'total_records_migrated': total_records,
            'total_errors': total_errors,
            'tables_migrated': len(table_migrations),
            'table_details': table_migrations,
            'validations': validations,
            'validation_passed': all(v.get('passed', False) for v in validations),
            'error': complete_entry.get('error') if complete_entry else None
        }
        
        return report
    
    def export_audit_log(self, output_file: str, 
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None) -> None:
        """
        Export audit log to file.
        
        Args:
            output_file: Output file path
            start_date: Filter by start date (ISO format)
            end_date: Filter by end date (ISO format)
        """
        entries = self.get_migration_history()
        
        # Apply date filters
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
            entries = [e for e in entries if datetime.fromisoformat(e['timestamp']) >= start_dt]
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
            entries = [e for e in entries if datetime.fromisoformat(e['timestamp']) <= end_dt]
        
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(entries, f, indent=2, default=str)
        
        logger.info(f"Exported {len(entries)} audit log entries to {output_file}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Migration audit trail system')
    parser.add_argument('--action', required=True,
                       choices=['start', 'complete', 'rollback', 'view', 'report', 'export'],
                       help='Action to perform')
    parser.add_argument('--migration-id', help='Migration ID')
    parser.add_argument('--migration-type', help='Migration type (full, incremental, test, rollback)')
    parser.add_argument('--user', help='Username performing migration')
    parser.add_argument('--description', help='Migration description')
    parser.add_argument('--stats-file', help='Path to migration stats JSON file')
    parser.add_argument('--success', action='store_true', help='Migration succeeded')
    parser.add_argument('--error', help='Error message if migration failed')
    parser.add_argument('--reason', help='Reason for rollback')
    parser.add_argument('--limit', type=int, default=10, help='Limit for view action')
    parser.add_argument('--output', help='Output file for export action')
    
    args = parser.parse_args()
    
    audit = MigrationAudit()
    
    try:
        if args.action == 'start':
            if not args.migration_type or not args.user:
                parser.error("--migration-type and --user are required for start action")
            
            migration_id = audit.log_migration_start(
                migration_type=args.migration_type,
                user=args.user,
                description=args.description
            )
            print(f"Migration started: {migration_id}")
        
        elif args.action == 'complete':
            if not args.migration_id:
                parser.error("--migration-id is required for complete action")
            
            stats = {}
            if args.stats_file:
                with open(args.stats_file, 'r') as f:
                    stats = json.load(f)
            
            audit.log_migration_complete(
                migration_id=args.migration_id,
                stats=stats,
                success=args.success,
                error=args.error
            )
            print(f"Migration completed: {args.migration_id}")
        
        elif args.action == 'rollback':
            if not args.migration_id or not args.user:
                parser.error("--migration-id and --user are required for rollback action")
            
            audit.log_migration_rollback(
                migration_id=args.migration_id,
                user=args.user,
                reason=args.reason
            )
            print(f"Migration rollback logged: {args.migration_id}")
        
        elif args.action == 'view':
            entries = audit.get_migration_history(limit=args.limit)
            print(json.dumps(entries, indent=2, default=str))
        
        elif args.action == 'report':
            if not args.migration_id:
                parser.error("--migration-id is required for report action")
            
            report = audit.generate_migration_report(args.migration_id)
            print(json.dumps(report, indent=2, default=str))
        
        elif args.action == 'export':
            if not args.output:
                parser.error("--output is required for export action")
            
            audit.export_audit_log(args.output)
            print(f"Audit log exported to: {args.output}")
    
    except Exception as e:
        logger.error(f"Action failed: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
