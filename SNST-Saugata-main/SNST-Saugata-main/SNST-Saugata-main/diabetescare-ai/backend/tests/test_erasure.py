"""
Comprehensive test suite for erasure module.

Tests DPDP Act 2023 Right to Erasure (Section 8):
- 72-hour erasure request workflow
- Cascading deletion in correct dependency order
- Verification of complete data removal
- Audit trail logging

Owner: Saugata Malakar
"""

import pytest
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database.erasure import (
    ErasurePipeline,
    ErasureScheduler,
    DeletionPriority,
    DELETION_ORDER_EXAMPLE
)


class TestErasurePipeline:
    """Test core erasure pipeline functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        session = Mock()
        session.execute = Mock()
        session.commit = Mock()
        session.rollback = Mock()
        return session
    
    @pytest.fixture
    def pipeline(self, mock_db_session):
        """Create erasure pipeline with mock database."""
        return ErasurePipeline(mock_db_session)
    
    def test_deletion_order_priorities(self):
        """Test deletion order respects dependency priorities."""
        from database.erasure import ErasurePipeline
        
        # Group tables by priority
        priority_groups = {}
        for table, priority in ErasurePipeline.DELETION_ORDER.items():
            if priority not in priority_groups:
                priority_groups[priority] = []
            priority_groups[priority].append(table)
        
        # Verify we have all 4 priority levels
        assert DeletionPriority.LEVEL_1 in priority_groups
        assert DeletionPriority.LEVEL_2 in priority_groups
        assert DeletionPriority.LEVEL_3 in priority_groups
        assert DeletionPriority.LEVEL_4 in priority_groups
        
        # Verify leaf nodes (transactions) are in LEVEL_1
        level_1_tables = priority_groups[DeletionPriority.LEVEL_1]
        assert "payment_transactions" in level_1_tables
        assert "asha_commissions" in level_1_tables
        
        # Verify core patient data is in LEVEL_4 (deleted last)
        level_4_tables = priority_groups[DeletionPriority.LEVEL_4]
        assert "patients" in level_4_tables
        assert "patient_medical_history" in level_4_tables
    
    def test_patient_reference_mapping(self):
        """Test patient reference field mapping is complete."""
        from database.erasure import ErasurePipeline
        
        # Verify all tables in deletion order have reference mappings
        for table_name in ErasurePipeline.DELETION_ORDER.keys():
            assert table_name in ErasurePipeline.PATIENT_REFS, f"Missing reference for {table_name}"
        
        # Verify common reference patterns
        assert ErasurePipeline.PATIENT_REFS["patients"] == "patient_id"
        assert ErasurePipeline.PATIENT_REFS["monitoring_sessions"] == "patient_id"
        assert ErasurePipeline.PATIENT_REFS["prescriptions"] == "patient_id"
    
    def test_request_erasure(self, pipeline):
        """Test erasure request creation."""
        patient_id = "pat_12345"
        reason = "patient-requested"
        
        with patch('database.erasure.uuid') as mock_uuid, \
             patch('database.erasure.datetime') as mock_datetime, \
             patch('database.erasure.AuditLogger') as mock_logger:
            
            # Mock UUID generation
            mock_uuid.uuid4.return_value = Mock()
            mock_uuid.uuid4.return_value.__str__ = Mock(return_value="req_67890")
            
            # Mock datetime
            mock_now = datetime(2024, 1, 15, 10, 0, 0)
            mock_datetime.now.return_value = mock_now
            
            # Execute request
            request_id = pipeline.request_erasure(patient_id, reason)
            
            # Verify request ID returned
            assert request_id == "req_67890"
            
            # Verify audit logging
            mock_logger.log_patient_deletion.assert_called_once()
    
    def test_execute_erasure_dry_run(self, pipeline):
        """Test dry run erasure execution."""
        patient_id = "pat_12345"
        
        # Mock table deletion counts
        with patch.object(pipeline, '_delete_from_table') as mock_delete, \
             patch.object(pipeline, '_verify_deletion') as mock_verify:
            
            # Setup mocks
            mock_delete.return_value = 5  # 5 records per table
            mock_verify.return_value = {"patients": 0, "monitoring_sessions": 0}
            
            # Execute dry run
            result = pipeline.execute_erasure(patient_id, dry_run=True)
            
            # Verify result structure
            assert result["patient_id"] == patient_id
            assert result["dry_run"] is True
            assert result["status"] == "success"
            assert "deletion_log" in result
            assert "total_rows_deleted" in result
            assert "verification" in result
            
            # Verify database rollback for dry run
            pipeline.db_session.rollback.assert_called_once()
            pipeline.db_session.commit.assert_not_called()
    
    def test_execute_erasure_real_deletion(self, pipeline):
        """Test actual erasure execution."""
        patient_id = "pat_12345"
        
        with patch.object(pipeline, '_delete_from_table') as mock_delete, \
             patch.object(pipeline, '_verify_deletion') as mock_verify:
            
            # Setup mocks
            mock_delete.return_value = 3
            mock_verify.return_value = {"patients": 0}  # All deleted
            
            # Execute real deletion
            result = pipeline.execute_erasure(patient_id, dry_run=False)
            
            # Verify database commit
            pipeline.db_session.commit.assert_called()
            pipeline.db_session.rollback.assert_not_called()
            
            # Verify success status
            assert result["status"] == "success"
            assert result["dry_run"] is False
    
    def test_execute_erasure_with_error(self, pipeline):
        """Test erasure execution with database error."""
        patient_id = "pat_12345"
        
        with patch.object(pipeline, '_delete_from_table') as mock_delete:
            # Simulate database error
            mock_delete.side_effect = Exception("Database connection failed")
            
            # Execute erasure
            result = pipeline.execute_erasure(patient_id, dry_run=False)
            
            # Verify error handling
            assert result["status"] == "failed"
            assert "error" in result
            assert "Database connection failed" in result["error"]
            
            # Verify rollback on error
            pipeline.db_session.rollback.assert_called_once()
    
    def test_delete_from_table_direct_reference(self, pipeline):
        """Test deletion from table with direct patient reference."""
        table_name = "prescriptions"
        ref_field = "patient_id"
        patient_id = "pat_12345"
        
        # Mock database execution
        mock_result = Mock()
        mock_result.scalar.return_value = 3  # 3 records to delete
        pipeline.db_session.execute.return_value = mock_result
        
        # Execute deletion
        count = pipeline._delete_from_table(table_name, ref_field, patient_id, dry_run=False)
        
        # Verify count returned
        assert count == 3
        
        # Verify SQL execution (2 calls: count + delete)
        assert pipeline.db_session.execute.call_count == 2
    
    def test_delete_from_table_indirect_reference(self, pipeline):
        """Test deletion from table with indirect patient reference."""
        table_name = "ai_results"
        ref_field = "session_id"
        patient_id = "pat_12345"
        
        # Mock database execution
        mock_result = Mock()
        mock_result.scalar.return_value = 8  # 8 AI results via sessions
        pipeline.db_session.execute.return_value = mock_result
        
        # Execute deletion
        count = pipeline._delete_from_table(table_name, ref_field, patient_id, dry_run=False)
        
        # Verify count
        assert count == 8
        
        # Verify complex query was used (via monitoring_sessions)
        calls = pipeline.db_session.execute.call_args_list
        assert len(calls) == 2  # Count + delete queries
        
        # Check that query includes JOIN logic
        count_query = str(calls[0][0][0])
        assert "monitoring_sessions" in count_query
    
    def test_delete_from_table_dry_run(self, pipeline):
        """Test deletion in dry run mode."""
        table_name = "patients"
        ref_field = "patient_id"
        patient_id = "pat_12345"
        
        # Mock count query
        mock_result = Mock()
        mock_result.scalar.return_value = 1
        pipeline.db_session.execute.return_value = mock_result
        
        # Execute dry run
        count = pipeline._delete_from_table(table_name, ref_field, patient_id, dry_run=True)
        
        # Verify count returned but no deletion executed
        assert count == 1
        assert pipeline.db_session.execute.call_count == 1  # Only count query
    
    def test_verify_deletion_complete(self, pipeline):
        """Test verification when all data is deleted."""
        patient_id = "pat_12345"
        
        # Mock all tables return 0 remaining records
        mock_result = Mock()
        mock_result.scalar.return_value = 0
        pipeline.db_session.execute.return_value = mock_result
        
        # Execute verification
        verification = pipeline._verify_deletion(patient_id)
        
        # Verify all tables checked
        assert len(verification) == len(pipeline.PATIENT_REFS)
        
        # Verify all counts are 0
        for table, count in verification.items():
            assert count == 0, f"Table {table} should have 0 remaining records"
    
    def test_verify_deletion_incomplete(self, pipeline):
        """Test verification when some data remains."""
        patient_id = "pat_12345"
        
        def mock_execute(query, params):
            # Simulate remaining records in some tables
            query_str = str(query)
            if "patients" in query_str:
                result = Mock()
                result.scalar.return_value = 1  # 1 patient record remains
                return result
            else:
                result = Mock()
                result.scalar.return_value = 0  # Other tables clean
                return result
        
        pipeline.db_session.execute.side_effect = mock_execute
        
        # Execute verification
        verification = pipeline._verify_deletion(patient_id)
        
        # Verify incomplete deletion detected
        assert verification["patients"] == 1
        
        # Verify warning logged
        with patch('database.erasure.logger') as mock_logger:
            pipeline._verify_deletion(patient_id)
            mock_logger.warning.assert_called()
    
    def test_export_deletion_log(self, pipeline):
        """Test deletion log export."""
        # Setup deletion log
        pipeline.start_time = datetime(2024, 1, 15, 10, 0, 0)
        pipeline.end_time = datetime(2024, 1, 15, 10, 5, 30)
        pipeline.deletion_log = [
            {
                "table": "prescriptions",
                "rows_deleted": 5,
                "timestamp": "2024-01-15T10:01:00"
            },
            {
                "table": "patients",
                "rows_deleted": 1,
                "timestamp": "2024-01-15T10:05:00"
            }
        ]
        
        # Export log
        log_json = pipeline.export_deletion_log()
        
        # Verify JSON structure
        log_data = json.loads(log_json)
        assert "start_time" in log_data
        assert "end_time" in log_data
        assert "deletion_log" in log_data
        assert len(log_data["deletion_log"]) == 2


class TestErasureScheduler:
    """Test erasure scheduling functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        return Mock()
    
    @pytest.fixture
    def scheduler(self, mock_db_session):
        return ErasureScheduler(mock_db_session)
    
    def test_schedule_erasure(self, scheduler):
        """Test scheduling an erasure request."""
        patient_id = "pat_12345"
        
        with patch.object(scheduler.pipeline, 'request_erasure') as mock_request:
            mock_request.return_value = {
                "patient_id": patient_id,
                "requested_at": "2024-01-15T10:00:00",
                "status": "pending"
            }
            
            # Schedule erasure
            result = scheduler.schedule_erasure(patient_id)
            
            # Verify request created
            assert result["patient_id"] == patient_id
            assert result["status"] == "pending"
            mock_request.assert_called_once_with(patient_id)
    
    def test_process_pending_erasures(self, scheduler):
        """Test processing pending erasure requests."""
        # Mock pending requests (would normally query database)
        with patch.object(scheduler.pipeline, 'execute_erasure') as mock_execute:
            mock_execute.return_value = {
                "patient_id": "pat_12345",
                "status": "completed",
                "total_rows_deleted": 25
            }
            
            # Process pending (empty for now since no DB integration)
            reports = scheduler.process_pending_erasures()
            
            # Verify structure (empty list since no real DB)
            assert isinstance(reports, list)


class TestDeletionOrderValidation:
    """Test deletion order respects foreign key constraints."""
    
    def test_deletion_order_example_format(self):
        """Test deletion order example is properly formatted."""
        assert isinstance(DELETION_ORDER_EXAMPLE, str)
        assert "payment_transactions" in DELETION_ORDER_EXAMPLE
        assert "patients" in DELETION_ORDER_EXAMPLE
        assert "Total rows deleted" in DELETION_ORDER_EXAMPLE
    
    def test_foreign_key_dependency_order(self):
        """Test deletion order respects foreign key dependencies."""
        from database.erasure import ErasurePipeline
        
        # Get sorted deletion order
        sorted_tables = sorted(
            ErasurePipeline.DELETION_ORDER.items(),
            key=lambda x: x[1].value
        )
        
        # Verify leaf nodes (no dependencies) come first
        early_tables = [table for table, priority in sorted_tables[:5]]
        assert "payment_transactions" in early_tables
        assert "asha_commissions" in early_tables
        
        # Verify core entities come last
        late_tables = [table for table, priority in sorted_tables[-5:]]
        assert "patients" in late_tables
        assert "patient_medical_history" in late_tables
    
    def test_all_patient_related_tables_included(self):
        """Test all patient-related tables are included in deletion order."""
        from database.erasure import ErasurePipeline
        
        # Expected patient-related tables (based on schema)
        expected_tables = {
            "patients", "patient_medical_history", "wound_sites",
            "monitoring_sessions", "photographs", "ai_results",
            "alerts", "prescriptions", "teleconsult_requests",
            "asha_patient_assignments", "doctor_patient_assignments",
            "subscriptions", "payment_transactions", "session_schedule",
            "notifications", "consents", "research_exports"
        }
        
        # Tables in deletion order
        deletion_tables = set(ErasurePipeline.DELETION_ORDER.keys())
        
        # Verify all expected tables are included
        missing_tables = expected_tables - deletion_tables
        assert len(missing_tables) == 0, f"Missing tables in deletion order: {missing_tables}"


class TestIntegrationScenarios:
    """Integration tests with realistic scenarios."""
    
    @pytest.fixture
    def mock_db_session(self):
        session = Mock()
        session.execute = Mock()
        session.commit = Mock()
        session.rollback = Mock()
        return session
    
    def test_complete_patient_erasure_workflow(self, mock_db_session):
        """Test complete patient erasure from request to verification."""
        patient_id = "pat_12345"
        pipeline = ErasurePipeline(mock_db_session)
        
        # Mock deletion counts for different tables
        deletion_counts = {
            "payment_transactions": 2,
            "ai_results": 15,
            "photographs": 45,
            "monitoring_sessions": 12,
            "prescriptions": 8,
            "patients": 1
        }
        
        def mock_delete_from_table(table, ref_field, pid, dry_run):
            return deletion_counts.get(table, 0)
        
        def mock_verify_deletion(pid):
            # All tables clean after deletion
            return {table: 0 for table in deletion_counts.keys()}
        
        with patch.object(pipeline, '_delete_from_table', side_effect=mock_delete_from_table), \
             patch.object(pipeline, '_verify_deletion', side_effect=mock_verify_deletion):
            
            # Execute full erasure
            result = pipeline.execute_erasure(patient_id, dry_run=False)
            
            # Verify successful completion
            assert result["status"] == "success"
            assert result["patient_id"] == patient_id
            assert result["total_rows_deleted"] == sum(deletion_counts.values())
            
            # Verify all tables processed
            assert len(result["deletion_log"]) > 0
            
            # Verify verification passed
            verification = result["verification"]
            for table, count in verification.items():
                assert count == 0, f"Table {table} should be clean"
    
    def test_partial_erasure_failure_scenario(self, mock_db_session):
        """Test handling of partial erasure failure."""
        patient_id = "pat_12345"
        pipeline = ErasurePipeline(mock_db_session)
        
        def mock_delete_with_error(table, ref_field, pid, dry_run):
            if table == "monitoring_sessions":
                raise Exception("Foreign key constraint violation")
            return 5
        
        with patch.object(pipeline, '_delete_from_table', side_effect=mock_delete_with_error):
            # Execute erasure
            result = pipeline.execute_erasure(patient_id, dry_run=False)
            
            # Verify error handling
            assert result["status"] == "failed"
            assert "Foreign key constraint violation" in result["error"]
            
            # Verify rollback occurred
            mock_db_session.rollback.assert_called_once()
    
    def test_large_dataset_erasure_performance(self, mock_db_session):
        """Test erasure performance with large dataset."""
        patient_id = "pat_12345"
        pipeline = ErasurePipeline(mock_db_session)
        
        # Simulate large dataset
        large_counts = {
            "photographs": 1000,
            "ai_results": 500,
            "monitoring_sessions": 200,
            "alerts": 50,
            "patients": 1
        }
        
        def mock_delete_large(table, ref_field, pid, dry_run):
            return large_counts.get(table, 0)
        
        def mock_verify_large(pid):
            return {table: 0 for table in large_counts.keys()}
        
        with patch.object(pipeline, '_delete_from_table', side_effect=mock_delete_large), \
             patch.object(pipeline, '_verify_deletion', side_effect=mock_verify_large):
            
            # Execute erasure
            start_time = datetime.now()
            result = pipeline.execute_erasure(patient_id, dry_run=False)
            end_time = datetime.now()
            
            # Verify large dataset handled
            assert result["total_rows_deleted"] == sum(large_counts.values())
            assert result["status"] == "success"
            
            # Verify reasonable performance (should complete quickly in mock)
            duration = (end_time - start_time).total_seconds()
            assert duration < 5.0  # Should complete in under 5 seconds


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])