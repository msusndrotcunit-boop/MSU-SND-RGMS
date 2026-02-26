"""
Custom logging formatters for structured logging.
"""
import json
import logging
import traceback
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    Outputs log records as JSON for easy parsing and analysis.
    """
    
    def format(self, record):
        """
        Format the log record as JSON.
        
        Args:
            record: LogRecord instance
            
        Returns:
            JSON string
        """
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add exception information if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
        
        # Add extra fields from the record
        if hasattr(record, 'user'):
            log_data['user'] = record.user
        if hasattr(record, 'ip_address'):
            log_data['ip_address'] = record.ip_address
        if hasattr(record, 'path'):
            log_data['path'] = record.path
        if hasattr(record, 'method'):
            log_data['method'] = record.method
        if hasattr(record, 'status_code'):
            log_data['status_code'] = record.status_code
        if hasattr(record, 'response_time'):
            log_data['response_time'] = record.response_time
        if hasattr(record, 'event_type'):
            log_data['event_type'] = record.event_type
        
        # Add any other extra fields
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName',
                          'levelname', 'levelno', 'lineno', 'module', 'msecs',
                          'message', 'pathname', 'process', 'processName',
                          'relativeCreated', 'thread', 'threadName', 'exc_info',
                          'exc_text', 'stack_info', 'user', 'ip_address', 'path',
                          'method', 'status_code', 'response_time', 'event_type']:
                try:
                    # Only add JSON-serializable values
                    json.dumps(value)
                    log_data[key] = value
                except (TypeError, ValueError):
                    log_data[key] = str(value)
        
        return json.dumps(log_data)
