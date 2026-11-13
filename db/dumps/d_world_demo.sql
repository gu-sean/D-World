--
-- PostgreSQL database dump
--

\restrict FPjhsMwLotmUmHaCRydojCexSFWzwzYiKcXksBB214QG6Uepo4hAPffFviiX9Tn

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.weather_observations DROP CONSTRAINT IF EXISTS weather_observations_nx_ny_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_reviewed_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_criteria_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_criteria_versions DROP CONSTRAINT IF EXISTS verification_criteria_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_criteria_versions DROP CONSTRAINT IF EXISTS verification_criteria_versions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_reviewed_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_resolution_result_id_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_record_id_filed_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_original_result_id_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_species_version_id_species_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_level_policy_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_notice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_level_thresholds DROP CONSTRAINT IF EXISTS user_level_thresholds_policy_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_level_policy_versions DROP CONSTRAINT IF EXISTS user_level_policy_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory DROP CONSTRAINT IF EXISTS user_inventory_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory DROP CONSTRAINT IF EXISTS user_inventory_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory_events DROP CONSTRAINT IF EXISTS user_inventory_events_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory_events DROP CONSTRAINT IF EXISTS user_inventory_events_order_id_user_id_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory_events DROP CONSTRAINT IF EXISTS user_inventory_events_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_idempotency_keys DROP CONSTRAINT IF EXISTS user_idempotency_keys_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_experience DROP CONSTRAINT IF EXISTS user_experience_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_experience DROP CONSTRAINT IF EXISTS user_experience_level_policy_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_badge_image_id_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievement_version_id_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_achievement_events DROP CONSTRAINT IF EXISTS user_achievement_events_user_achievement_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_target_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_target_mission_definition_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_target_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_reporter_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assigned_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_resolutions DROP CONSTRAINT IF EXISTS support_ticket_resolutions_ticket_id_ticket_type_fkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_resolutions DROP CONSTRAINT IF EXISTS support_ticket_resolutions_resolved_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_resolutions DROP CONSTRAINT IF EXISTS support_ticket_resolutions_account_action_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_ticket_id_fkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_states DROP CONSTRAINT IF EXISTS streak_states_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_policy_versions DROP CONSTRAINT IF EXISTS streak_milestone_policy_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_user_id_first_achieved_date_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_policy_version_id_target_success_d_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_days DROP CONSTRAINT IF EXISTS streak_days_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_days DROP CONSTRAINT IF EXISTS streak_days_qualifying_result_id_qualifying_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_days DROP CONSTRAINT IF EXISTS streak_days_qualifying_record_id_qualifying_mission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streak_days DROP CONSTRAINT IF EXISTS streak_days_qualifying_mission_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_spend_transaction_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_refund_transaction_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_price_version_id_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_item_price_versions DROP CONSTRAINT IF EXISTS shop_item_price_versions_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.shop_item_price_versions DROP CONSTRAINT IF EXISTS shop_item_price_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recommendation_messages DROP CONSTRAINT IF EXISTS recommendation_messages_updated_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recommendation_messages DROP CONSTRAINT IF EXISTS recommendation_messages_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recommendation_messages DROP CONSTRAINT IF EXISTS recommendation_messages_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.push_devices DROP CONSTRAINT IF EXISTS push_devices_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_representative_pet_owner_fk;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_representative_achievement_owner_fk;
ALTER TABLE IF EXISTS ONLY public.point_wallets DROP CONSTRAINT IF EXISTS point_wallets_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_recovery_claim_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_original_transaction_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_streak_award_owner_fk;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_original_award_owner_fk;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_claims_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_claims_mission_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_challenge_grant_owner_fk;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_achievement_owner_fk;
ALTER TABLE IF EXISTS ONLY public.point_monthly_usage DROP CONSTRAINT IF EXISTS point_monthly_usage_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.point_monthly_cap_policies DROP CONSTRAINT IF EXISTS point_monthly_cap_policies_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.plan_adjustment_proposals DROP CONSTRAINT IF EXISTS plan_adjustment_proposals_run_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.plan_adjustment_proposals DROP CONSTRAINT IF EXISTS plan_adjustment_proposals_run_id_run_type_fkey;
ALTER TABLE IF EXISTS ONLY public.plan_adjustment_proposals DROP CONSTRAINT IF EXISTS plan_adjustment_proposals_goal_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.phone_credentials DROP CONSTRAINT IF EXISTS phone_credentials_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_versions DROP CONSTRAINT IF EXISTS pet_stage_versions_species_version_id_species_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_versions DROP CONSTRAINT IF EXISTS pet_stage_versions_image_id_species_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_images DROP CONSTRAINT IF EXISTS pet_stage_images_species_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_images DROP CONSTRAINT IF EXISTS pet_stage_images_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_dialogues DROP CONSTRAINT IF EXISTS pet_stage_dialogues_species_version_id_stage_no_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_unlock_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_unlock_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_species_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_species DROP CONSTRAINT IF EXISTS pet_species_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_level_thresholds DROP CONSTRAINT IF EXISTS pet_level_thresholds_policy_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_level_policy_versions DROP CONSTRAINT IF EXISTS pet_level_policy_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pet_evolution_events DROP CONSTRAINT IF EXISTS pet_evolution_events_user_pet_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pending_pet_experience DROP CONSTRAINT IF EXISTS pending_pet_experience_experience_award_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pending_pet_experience DROP CONSTRAINT IF EXISTS pending_pet_experience_assigned_pet_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notices DROP CONSTRAINT IF EXISTS notices_policy_document_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notices DROP CONSTRAINT IF EXISTS notices_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notice_recipients DROP CONSTRAINT IF EXISTS notice_recipients_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notice_recipients DROP CONSTRAINT IF EXISTS notice_recipients_notice_id_audience_type_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_source_proposal_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_reward_rate_matches_category_difficulty;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_goal_step_id_goal_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_goal_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_difficulty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_definition_id_fkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_difficulty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_reward_pet_owner_fk;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_mission_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_publication_reviews DROP CONSTRAINT IF EXISTS mission_publication_reviews_reviewed_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_publication_reviews DROP CONSTRAINT IF EXISTS mission_publication_reviews_requested_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_publication_reviews DROP CONSTRAINT IF EXISTS mission_publication_reviews_definition_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_point_awards DROP CONSTRAINT IF EXISTS mission_point_awards_mission_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_point_awards DROP CONSTRAINT IF EXISTS mission_point_awards_first_approved_result_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_difficulty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.media_files DROP CONSTRAINT IF EXISTS media_files_record_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goals DROP CONSTRAINT IF EXISTS goals_difficulty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goals DROP CONSTRAINT IF EXISTS goals_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goal_steps DROP CONSTRAINT IF EXISTS goal_steps_goal_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_user_pet_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_original_transaction_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_experience_award_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_recipient_pet_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_pet_species_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.consent_records DROP CONSTRAINT IF EXISTS consent_records_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.consent_records DROP CONSTRAINT IF EXISTS consent_records_document_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenges DROP CONSTRAINT IF EXISTS challenges_difficulty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenges DROP CONSTRAINT IF EXISTS challenges_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenges DROP CONSTRAINT IF EXISTS challenges_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenges DROP CONSTRAINT IF EXISTS challenges_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_runs DROP CONSTRAINT IF EXISTS challenge_settlement_runs_confirmed_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_runs DROP CONSTRAINT IF EXISTS challenge_settlement_runs_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_entries DROP CONSTRAINT IF EXISTS challenge_settlement_entries_run_id_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_entries DROP CONSTRAINT IF EXISTS challenge_settlement_entries_participation_id_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_score_snapshots DROP CONSTRAINT IF EXISTS challenge_score_snapshots_participation_id_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_rule_events DROP CONSTRAINT IF EXISTS challenge_rule_events_requested_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_rule_events DROP CONSTRAINT IF EXISTS challenge_rule_events_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_rule_events DROP CONSTRAINT IF EXISTS challenge_rule_events_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_payment_attempts DROP CONSTRAINT IF EXISTS challenge_reward_payment_attempts_run_id_participation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_packages DROP CONSTRAINT IF EXISTS challenge_reward_packages_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_packages DROP CONSTRAINT IF EXISTS challenge_reward_packages_badge_achievement_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_recipient_pet_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_participation_id_challenge_id_user_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_first_settlement_run_id_challenge__fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_badge_grant_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_publication_reviews DROP CONSTRAINT IF EXISTS challenge_publication_reviews_reviewed_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_publication_reviews DROP CONSTRAINT IF EXISTS challenge_publication_reviews_requested_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_publication_reviews DROP CONSTRAINT IF EXISTS challenge_publication_reviews_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_challenge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_moderation_actions DROP CONSTRAINT IF EXISTS challenge_moderation_actions_participation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_moderation_actions DROP CONSTRAINT IF EXISTS challenge_moderation_actions_evidence_result_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_moderation_actions DROP CONSTRAINT IF EXISTS challenge_moderation_actions_daily_mission_id_participatio_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_moderation_actions DROP CONSTRAINT IF EXISTS challenge_moderation_actions_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_final_rankings DROP CONSTRAINT IF EXISTS challenge_final_rankings_run_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_final_rankings DROP CONSTRAINT IF EXISTS challenge_final_rankings_participation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_qualifying_result_id_qualifying_r_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_qualifying_record_id_mission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_participation_id_challenge_id_use_fkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_mission_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_reports DROP CONSTRAINT IF EXISTS ai_reports_run_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_reports DROP CONSTRAINT IF EXISTS ai_reports_run_id_run_type_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_recommendation_mission_fk;
ALTER TABLE IF EXISTS ONLY public.ai_plan_proposals DROP CONSTRAINT IF EXISTS ai_plan_proposals_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_plan_proposals DROP CONSTRAINT IF EXISTS ai_plan_proposals_goal_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_mission_recommendations_run_id_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_mission_recommendations_run_id_run_type_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_mission_recommendations_mission_definition_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_analysis_runs DROP CONSTRAINT IF EXISTS ai_analysis_runs_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_idempotency_keys DROP CONSTRAINT IF EXISTS admin_idempotency_keys_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_asset_uploads DROP CONSTRAINT IF EXISTS admin_asset_uploads_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_badge_image_id_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_created_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_backfill_runs DROP CONSTRAINT IF EXISTS achievement_backfill_runs_version_id_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_backfill_runs DROP CONSTRAINT IF EXISTS achievement_backfill_runs_requested_by_admin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievement_backfill_runs DROP CONSTRAINT IF EXISTS achievement_backfill_runs_achievement_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account_withdrawal_requests DROP CONSTRAINT IF EXISTS account_withdrawal_requests_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account_withdrawal_requests DROP CONSTRAINT IF EXISTS account_withdrawal_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.account_actions DROP CONSTRAINT IF EXISTS account_actions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account_actions DROP CONSTRAINT IF EXISTS account_actions_source_ticket_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account_actions DROP CONSTRAINT IF EXISTS account_actions_admin_id_fkey;
DROP TRIGGER IF EXISTS verification_results_validate_criteria_before_insert ON public.verification_results;
DROP TRIGGER IF EXISTS verification_results_protect_before_update ON public.verification_results;
DROP TRIGGER IF EXISTS verification_criteria_no_change ON public.verification_criteria_versions;
DROP TRIGGER IF EXISTS verification_appeals_guard_before_write ON public.verification_appeals;
DROP TRIGGER IF EXISTS users_scrub_mission_reviews_before_delete ON public.users;
DROP TRIGGER IF EXISTS users_scrub_challenge_logs ON public.users;
DROP TRIGGER IF EXISTS users_scrub_account_logs_before_delete ON public.users;
DROP TRIGGER IF EXISTS users_require_r2_cleanup_before_delete ON public.users;
DROP TRIGGER IF EXISTS users_delete_inquiries_before_delete ON public.users;
DROP TRIGGER IF EXISTS user_threshold_sequence ON public.user_level_thresholds;
DROP TRIGGER IF EXISTS user_threshold_no_change ON public.user_level_thresholds;
DROP TRIGGER IF EXISTS user_pets_no_direct_delete ON public.user_pets;
DROP TRIGGER IF EXISTS user_pets_guard ON public.user_pets;
DROP TRIGGER IF EXISTS user_notifications_guard_before_update ON public.user_notifications;
DROP TRIGGER IF EXISTS user_notifications_guard_before_insert ON public.user_notifications;
DROP TRIGGER IF EXISTS user_level_policy_no_change ON public.user_level_policy_versions;
DROP TRIGGER IF EXISTS user_inventory_events_no_change ON public.user_inventory_events;
DROP TRIGGER IF EXISTS user_inventory_events_apply_after_insert ON public.user_inventory_events;
DROP TRIGGER IF EXISTS user_idempotency_keys_guard_before_update ON public.user_idempotency_keys;
DROP TRIGGER IF EXISTS user_experience_guard ON public.user_experience;
DROP TRIGGER IF EXISTS user_achievements_paid_points_guard ON public.user_achievements;
DROP TRIGGER IF EXISTS user_achievements_no_direct_delete ON public.user_achievements;
DROP TRIGGER IF EXISTS user_achievements_lock_before_update ON public.user_achievements;
DROP TRIGGER IF EXISTS user_achievements_guard_before_insert ON public.user_achievements;
DROP TRIGGER IF EXISTS user_achievements_clear_representative_after_revoke ON public.user_achievements;
DROP TRIGGER IF EXISTS user_achievement_events_no_change ON public.user_achievement_events;
DROP TRIGGER IF EXISTS user_achievement_events_guard_before_insert ON public.user_achievement_events;
DROP TRIGGER IF EXISTS support_tickets_guard_before_update ON public.support_tickets;
DROP TRIGGER IF EXISTS support_ticket_events_no_change ON public.support_ticket_events;
DROP TRIGGER IF EXISTS support_resolutions_no_delete ON public.support_ticket_resolutions;
DROP TRIGGER IF EXISTS support_resolutions_guard_before_update ON public.support_ticket_resolutions;
DROP TRIGGER IF EXISTS support_resolutions_guard_before_insert ON public.support_ticket_resolutions;
DROP TRIGGER IF EXISTS streak_milestone_policies_no_change ON public.streak_milestone_policy_versions;
DROP TRIGGER IF EXISTS streak_milestone_awards_no_direct_delete ON public.streak_milestone_awards;
DROP TRIGGER IF EXISTS streak_milestone_awards_lock_before_update ON public.streak_milestone_awards;
DROP TRIGGER IF EXISTS streak_milestone_awards_guard_before_insert ON public.streak_milestone_awards;
DROP TRIGGER IF EXISTS streak_days_validate_success_before_write ON public.streak_days;
DROP TRIGGER IF EXISTS streak_days_reject_challenge ON public.streak_days;
DROP TRIGGER IF EXISTS shop_price_versions_no_change ON public.shop_item_price_versions;
DROP TRIGGER IF EXISTS shop_orders_guard_before_update ON public.shop_orders;
DROP TRIGGER IF EXISTS shop_orders_guard_before_insert ON public.shop_orders;
DROP TRIGGER IF EXISTS profiles_guard_representative_badge_before_write ON public.profiles;
DROP TRIGGER IF EXISTS point_transactions_streak_source_before_insert ON public.point_transactions;
DROP TRIGGER IF EXISTS point_transactions_no_change ON public.point_transactions;
DROP TRIGGER IF EXISTS point_transactions_guard_before_insert ON public.point_transactions;
DROP TRIGGER IF EXISTS point_transactions_challenge_source ON public.point_transactions;
DROP TRIGGER IF EXISTS point_transactions_achievement_source_before_insert ON public.point_transactions;
DROP TRIGGER IF EXISTS point_recovery_claims_streak_achievement_source ON public.point_recovery_claims;
DROP TRIGGER IF EXISTS point_recovery_challenge_source ON public.point_recovery_claims;
DROP TRIGGER IF EXISTS point_cap_policy_guard_before_insert ON public.point_monthly_cap_policies;
DROP TRIGGER IF EXISTS point_cap_policies_no_change ON public.point_monthly_cap_policies;
DROP TRIGGER IF EXISTS plan_adjustment_guard_before_update ON public.plan_adjustment_proposals;
DROP TRIGGER IF EXISTS plan_adjustment_guard_before_insert ON public.plan_adjustment_proposals;
DROP TRIGGER IF EXISTS pet_threshold_sequence ON public.pet_level_thresholds;
DROP TRIGGER IF EXISTS pet_threshold_no_change ON public.pet_level_thresholds;
DROP TRIGGER IF EXISTS pet_stage_versions_no_change ON public.pet_stage_versions;
DROP TRIGGER IF EXISTS pet_stage_sequence ON public.pet_stage_versions;
DROP TRIGGER IF EXISTS pet_stage_images_no_change ON public.pet_stage_images;
DROP TRIGGER IF EXISTS pet_stage_dialogues_no_change ON public.pet_stage_dialogues;
DROP TRIGGER IF EXISTS pet_species_versions_no_change ON public.pet_species_versions;
DROP TRIGGER IF EXISTS pet_level_policy_no_change ON public.pet_level_policy_versions;
DROP TRIGGER IF EXISTS notices_guard_before_update ON public.notices;
DROP TRIGGER IF EXISTS notices_guard_before_delete ON public.notices;
DROP TRIGGER IF EXISTS notice_recipients_guard_before_write ON public.notice_recipients;
DROP TRIGGER IF EXISTS missions_validate_xp_before_insert ON public.missions;
DROP TRIGGER IF EXISTS missions_validate_source_before_write ON public.missions;
DROP TRIGGER IF EXISTS missions_validate_reward_before_insert ON public.missions;
DROP TRIGGER IF EXISTS missions_lock_xp_before_update ON public.missions;
DROP TRIGGER IF EXISTS missions_lock_rules_before_update ON public.missions;
DROP TRIGGER IF EXISTS missions_lock_reward_before_update ON public.missions;
DROP TRIGGER IF EXISTS mission_reward_rates_no_change ON public.mission_reward_rate_versions;
DROP TRIGGER IF EXISTS mission_records_pet_snapshot ON public.mission_records;
DROP TRIGGER IF EXISTS mission_records_guard_before_write ON public.mission_records;
DROP TRIGGER IF EXISTS mission_point_awards_lock_before_update ON public.mission_point_awards;
DROP TRIGGER IF EXISTS mission_point_awards_guard_before_insert ON public.mission_point_awards;
DROP TRIGGER IF EXISTS goals_cancel_unstarted_missions_after_delete_mark ON public.goals;
DROP TRIGGER IF EXISTS experience_transactions_no_change ON public.experience_transactions;
DROP TRIGGER IF EXISTS experience_awards_guard ON public.experience_awards;
DROP TRIGGER IF EXISTS challenges_guard ON public.challenges;
DROP TRIGGER IF EXISTS challenge_settlement_runs_guard ON public.challenge_settlement_runs;
DROP TRIGGER IF EXISTS challenge_settlement_entries_guard ON public.challenge_settlement_entries;
DROP TRIGGER IF EXISTS challenge_reward_packages_guard ON public.challenge_reward_packages;
DROP TRIGGER IF EXISTS challenge_reward_grants_guard ON public.challenge_reward_grants;
DROP TRIGGER IF EXISTS challenge_participations_guard ON public.challenge_participations;
DROP TRIGGER IF EXISTS challenge_participation_anonymize ON public.challenge_participations;
DROP TRIGGER IF EXISTS challenge_final_rankings_guard ON public.challenge_final_rankings;
DROP TRIGGER IF EXISTS challenge_daily_missions_guard ON public.challenge_daily_missions;
DROP TRIGGER IF EXISTS ai_runs_guard_before_update ON public.ai_analysis_runs;
DROP TRIGGER IF EXISTS ai_reports_guard_before_update ON public.ai_reports;
DROP TRIGGER IF EXISTS ai_reports_guard_before_insert ON public.ai_reports;
DROP TRIGGER IF EXISTS ai_recommendations_guard_before_update ON public.ai_mission_recommendations;
DROP TRIGGER IF EXISTS ai_recommendations_guard_before_insert ON public.ai_mission_recommendations;
DROP TRIGGER IF EXISTS admin_idempotency_keys_guard_before_update ON public.admin_idempotency_keys;
DROP TRIGGER IF EXISTS achievement_versions_no_change ON public.achievement_versions;
DROP TRIGGER IF EXISTS achievement_badge_images_no_update ON public.achievement_badge_images;
CREATE OR REPLACE VIEW public.challenge_live_rankings AS
SELECT
    NULL::uuid AS challenge_id,
    NULL::uuid AS participation_id,
    NULL::uuid AS user_id,
    NULL::character varying(12) AS display_name,
    NULL::integer AS successful_days,
    NULL::integer AS score,
    NULL::timestamp with time zone AS last_qualifying_submitted_at,
    NULL::bigint AS rank_no;
DROP INDEX IF EXISTS public.weather_observations_observed_idx;
DROP INDEX IF EXISTS public.weather_grid_cells_recent_idx;
DROP INDEX IF EXISTS public.verification_results_record_recent_idx;
DROP INDEX IF EXISTS public.verification_results_one_current_uq;
DROP INDEX IF EXISTS public.verification_results_ingest_key_uq;
DROP INDEX IF EXISTS public.verification_criteria_current_idx;
DROP INDEX IF EXISTS public.verification_appeals_resolution_result_idx;
DROP INDEX IF EXISTS public.verification_appeals_record_idx;
DROP INDEX IF EXISTS public.verification_appeals_queue_idx;
DROP INDEX IF EXISTS public.user_pets_nickname_ci_uq;
DROP INDEX IF EXISTS public.user_notifications_unread_idx;
DROP INDEX IF EXISTS public.user_notifications_push_pending_idx;
DROP INDEX IF EXISTS public.user_notifications_notice_idx;
DROP INDEX IF EXISTS public.user_notifications_inbox_idx;
DROP INDEX IF EXISTS public.user_inventory_events_user_idx;
DROP INDEX IF EXISTS public.user_idempotency_keys_created_idx;
DROP INDEX IF EXISTS public.user_achievements_owner_status_idx;
DROP INDEX IF EXISTS public.user_achievement_events_recent_idx;
DROP INDEX IF EXISTS public.user_achievement_events_first_earned_uq;
DROP INDEX IF EXISTS public.support_tickets_target_user_idx;
DROP INDEX IF EXISTS public.support_tickets_target_mission_definition_idx;
DROP INDEX IF EXISTS public.support_tickets_target_challenge_idx;
DROP INDEX IF EXISTS public.support_tickets_reporter_idx;
DROP INDEX IF EXISTS public.support_tickets_queue_idx;
DROP INDEX IF EXISTS public.support_ticket_resolutions_account_action_idx;
DROP INDEX IF EXISTS public.support_ticket_events_ticket_idx;
DROP INDEX IF EXISTS public.support_open_report_user_uq;
DROP INDEX IF EXISTS public.support_open_report_mission_uq;
DROP INDEX IF EXISTS public.support_open_report_challenge_uq;
DROP INDEX IF EXISTS public.streak_milestone_policies_effective_idx;
DROP INDEX IF EXISTS public.streak_milestone_awards_user_idx;
DROP INDEX IF EXISTS public.streak_days_user_recent_idx;
DROP INDEX IF EXISTS public.streak_days_qualifying_result_idx;
DROP INDEX IF EXISTS public.streak_days_qualifying_record_idx;
DROP INDEX IF EXISTS public.streak_days_pending_idx;
DROP INDEX IF EXISTS public.shop_price_versions_effective_idx;
DROP INDEX IF EXISTS public.shop_orders_user_recent_idx;
DROP INDEX IF EXISTS public.shop_items_visible_idx;
DROP INDEX IF EXISTS public.recommendation_messages_active_idx;
DROP INDEX IF EXISTS public.push_devices_user_active_idx;
DROP INDEX IF EXISTS public.profiles_nickname_ci_uq;
DROP INDEX IF EXISTS public.policy_documents_effective_idx;
DROP INDEX IF EXISTS public.point_transactions_user_recent_idx;
DROP INDEX IF EXISTS public.point_transactions_source_idx;
DROP INDEX IF EXISTS public.point_transactions_recovery_claim_idx;
DROP INDEX IF EXISTS public.point_recovery_one_open_streak_claim_uq;
DROP INDEX IF EXISTS public.point_recovery_one_open_challenge_claim_uq;
DROP INDEX IF EXISTS public.point_recovery_one_open_achievement_claim_uq;
DROP INDEX IF EXISTS public.point_recovery_claims_streak_award_idx;
DROP INDEX IF EXISTS public.point_recovery_claims_pending_idx;
DROP INDEX IF EXISTS public.point_recovery_claims_challenge_grant_idx;
DROP INDEX IF EXISTS public.point_recovery_claims_achievement_idx;
DROP INDEX IF EXISTS public.plan_adjustment_open_idx;
DROP INDEX IF EXISTS public.plan_adjustment_goal_idx;
DROP INDEX IF EXISTS public.phone_challenges_recent_idx;
DROP INDEX IF EXISTS public.pet_evolution_events_user_pet_idx;
DROP INDEX IF EXISTS public.notices_published_idx;
DROP INDEX IF EXISTS public.notices_fanout_pending_idx;
DROP INDEX IF EXISTS public.notices_due_idx;
DROP INDEX IF EXISTS public.notice_recipients_user_idx;
DROP INDEX IF EXISTS public.missions_user_day_idx;
DROP INDEX IF EXISTS public.missions_streak_scan_idx;
DROP INDEX IF EXISTS public.missions_step_required_idx;
DROP INDEX IF EXISTS public.missions_goal_status_idx;
DROP INDEX IF EXISTS public.missions_definition_idx;
DROP INDEX IF EXISTS public.mission_reward_rates_effective_idx;
DROP INDEX IF EXISTS public.mission_records_review_queue_idx;
DROP INDEX IF EXISTS public.mission_records_mission_recent_idx;
DROP INDEX IF EXISTS public.mission_publication_reviews_requester_idx;
DROP INDEX IF EXISTS public.mission_publication_reviews_definition_idx;
DROP INDEX IF EXISTS public.mission_point_awards_user_idx;
DROP INDEX IF EXISTS public.mission_point_awards_first_result_idx;
DROP INDEX IF EXISTS public.mission_definitions_public_list_idx;
DROP INDEX IF EXISTS public.mission_definitions_owner_idx;
DROP INDEX IF EXISTS public.media_files_record_idx;
DROP INDEX IF EXISTS public.media_files_owner_status_idx;
DROP INDEX IF EXISTS public.goals_user_list_idx;
DROP INDEX IF EXISTS public.goal_categories_visible_idx;
DROP INDEX IF EXISTS public.experience_transactions_user_idx;
DROP INDEX IF EXISTS public.experience_transactions_award_idx;
DROP INDEX IF EXISTS public.difficulty_levels_visible_idx;
DROP INDEX IF EXISTS public.consent_records_latest_idx;
DROP INDEX IF EXISTS public.challenges_public_idx;
DROP INDEX IF EXISTS public.challenges_creator_idx;
DROP INDEX IF EXISTS public.challenge_settlement_rank_uq;
DROP INDEX IF EXISTS public.challenge_settlement_entries_participation_idx;
DROP INDEX IF EXISTS public.challenge_rule_events_requester_idx;
DROP INDEX IF EXISTS public.challenge_rule_events_challenge_idx;
DROP INDEX IF EXISTS public.challenge_reward_payment_attempts_due_idx;
DROP INDEX IF EXISTS public.challenge_publication_reviews_requester_idx;
DROP INDEX IF EXISTS public.challenge_publication_reviews_challenge_idx;
DROP INDEX IF EXISTS public.challenge_participations_user_idx;
DROP INDEX IF EXISTS public.challenge_participations_challenge_idx;
DROP INDEX IF EXISTS public.challenge_one_current_settlement_uq;
DROP INDEX IF EXISTS public.challenge_moderation_actions_participation_idx;
DROP INDEX IF EXISTS public.challenge_moderation_actions_evidence_idx;
DROP INDEX IF EXISTS public.challenge_moderation_actions_daily_mission_idx;
DROP INDEX IF EXISTS public.challenge_final_rankings_participation_idx;
DROP INDEX IF EXISTS public.challenge_daily_missions_score_idx;
DROP INDEX IF EXISTS public.challenge_daily_missions_qualifying_result_idx;
DROP INDEX IF EXISTS public.challenge_daily_missions_pending_idx;
DROP INDEX IF EXISTS public.auth_sessions_user_expiry_idx;
DROP INDEX IF EXISTS public.ai_runs_user_recent_idx;
DROP INDEX IF EXISTS public.ai_runs_pending_idx;
DROP INDEX IF EXISTS public.ai_runs_one_current_period_uq;
DROP INDEX IF EXISTS public.ai_runs_generation_uq;
DROP INDEX IF EXISTS public.ai_reports_user_recent_idx;
DROP INDEX IF EXISTS public.ai_plan_proposals_user_idx;
DROP INDEX IF EXISTS public.ai_plan_proposals_goal_idx;
DROP INDEX IF EXISTS public.ai_mission_recommendations_user_idx;
DROP INDEX IF EXISTS public.ai_mission_recommendations_mission_idx;
DROP INDEX IF EXISTS public.ai_mission_recommendations_definition_idx;
DROP INDEX IF EXISTS public.admin_sessions_admin_expiry_idx;
DROP INDEX IF EXISTS public.admin_idempotency_keys_created_idx;
DROP INDEX IF EXISTS public.admin_audit_target_time_idx;
DROP INDEX IF EXISTS public.admin_audit_actor_time_idx;
DROP INDEX IF EXISTS public.admin_asset_uploads_owner_idx;
DROP INDEX IF EXISTS public.admin_asset_uploads_admin_idx;
DROP INDEX IF EXISTS public.admin_accounts_login_id_ci_uq;
DROP INDEX IF EXISTS public.admin_accounts_email_uq;
DROP INDEX IF EXISTS public.achievement_versions_effective_idx;
DROP INDEX IF EXISTS public.achievement_backfill_runs_pending_idx;
DROP INDEX IF EXISTS public.achievement_backfill_runs_admin_idx;
DROP INDEX IF EXISTS public.achievement_backfill_runs_achievement_idx;
DROP INDEX IF EXISTS public.account_withdrawal_queue_idx;
DROP INDEX IF EXISTS public.account_withdrawal_one_open_uq;
DROP INDEX IF EXISTS public.account_actions_user_period_idx;
DROP INDEX IF EXISTS public.account_actions_source_ticket_idx;
ALTER TABLE IF EXISTS ONLY public.weather_observations DROP CONSTRAINT IF EXISTS weather_observations_pkey;
ALTER TABLE IF EXISTS ONLY public.weather_grid_cells DROP CONSTRAINT IF EXISTS weather_grid_cells_pkey;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_record_id_result_no_key;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_pkey;
ALTER TABLE IF EXISTS ONLY public.verification_results DROP CONSTRAINT IF EXISTS verification_results_id_record_id_key;
ALTER TABLE IF EXISTS ONLY public.verification_criteria_versions DROP CONSTRAINT IF EXISTS verification_criteria_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.verification_criteria_versions DROP CONSTRAINT IF EXISTS verification_criteria_version_category_id_verification_meth_key;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_pkey;
ALTER TABLE IF EXISTS ONLY public.verification_appeals DROP CONSTRAINT IF EXISTS verification_appeals_original_result_id_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_user_id_species_id_key;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_pkey;
ALTER TABLE IF EXISTS ONLY public.user_pets DROP CONSTRAINT IF EXISTS user_pets_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_user_id_notice_id_key;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_user_id_event_key_key;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.user_level_thresholds DROP CONSTRAINT IF EXISTS user_level_thresholds_policy_version_id_min_total_xp_key;
ALTER TABLE IF EXISTS ONLY public.user_level_thresholds DROP CONSTRAINT IF EXISTS user_level_thresholds_pkey;
ALTER TABLE IF EXISTS ONLY public.user_level_policy_versions DROP CONSTRAINT IF EXISTS user_level_policy_versions_version_no_key;
ALTER TABLE IF EXISTS ONLY public.user_level_policy_versions DROP CONSTRAINT IF EXISTS user_level_policy_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory DROP CONSTRAINT IF EXISTS user_inventory_pkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory_events DROP CONSTRAINT IF EXISTS user_inventory_events_pkey;
ALTER TABLE IF EXISTS ONLY public.user_inventory_events DROP CONSTRAINT IF EXISTS user_inventory_events_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_user_id_provider_key;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_provider_provider_subject_key;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_pkey;
ALTER TABLE IF EXISTS ONLY public.user_idempotency_keys DROP CONSTRAINT IF EXISTS user_idempotency_keys_user_id_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.user_idempotency_keys DROP CONSTRAINT IF EXISTS user_idempotency_keys_pkey;
ALTER TABLE IF EXISTS ONLY public.user_experience DROP CONSTRAINT IF EXISTS user_experience_pkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_id_key;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_pkey;
ALTER TABLE IF EXISTS ONLY public.user_achievements DROP CONSTRAINT IF EXISTS user_achievements_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.user_achievement_events DROP CONSTRAINT IF EXISTS user_achievement_events_pkey;
ALTER TABLE IF EXISTS ONLY public.user_achievement_events DROP CONSTRAINT IF EXISTS user_achievement_events_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_pkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_id_ticket_type_key;
ALTER TABLE IF EXISTS ONLY public.support_ticket_resolutions DROP CONSTRAINT IF EXISTS support_ticket_resolutions_pkey;
ALTER TABLE IF EXISTS ONLY public.support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_pkey;
ALTER TABLE IF EXISTS ONLY public.streak_states DROP CONSTRAINT IF EXISTS streak_states_pkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_policy_versions DROP CONSTRAINT IF EXISTS streak_milestone_policy_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_policy_versions DROP CONSTRAINT IF EXISTS streak_milestone_policy_versions_id_target_success_days_key;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_policy_versions DROP CONSTRAINT IF EXISTS streak_milestone_policy_versi_target_success_days_version_n_key;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_user_id_target_success_days_key;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_pkey;
ALTER TABLE IF EXISTS ONLY public.streak_milestone_awards DROP CONSTRAINT IF EXISTS streak_milestone_awards_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.streak_days DROP CONSTRAINT IF EXISTS streak_days_pkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_user_id_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_pkey;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_id_user_id_item_id_key;
ALTER TABLE IF EXISTS ONLY public.shop_items DROP CONSTRAINT IF EXISTS shop_items_pkey;
ALTER TABLE IF EXISTS ONLY public.shop_items DROP CONSTRAINT IF EXISTS shop_items_id_item_kind_key;
ALTER TABLE IF EXISTS ONLY public.shop_items DROP CONSTRAINT IF EXISTS shop_items_code_key;
ALTER TABLE IF EXISTS ONLY public.shop_item_price_versions DROP CONSTRAINT IF EXISTS shop_item_price_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.shop_item_price_versions DROP CONSTRAINT IF EXISTS shop_item_price_versions_item_id_version_no_key;
ALTER TABLE IF EXISTS ONLY public.shop_item_price_versions DROP CONSTRAINT IF EXISTS shop_item_price_versions_id_item_id_key;
ALTER TABLE IF EXISTS ONLY public.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.recommendation_messages DROP CONSTRAINT IF EXISTS recommendation_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.push_devices DROP CONSTRAINT IF EXISTS push_devices_token_key;
ALTER TABLE IF EXISTS ONLY public.push_devices DROP CONSTRAINT IF EXISTS push_devices_pkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.policy_document_versions DROP CONSTRAINT IF EXISTS policy_document_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.policy_document_versions DROP CONSTRAINT IF EXISTS policy_document_versions_document_type_version_key;
ALTER TABLE IF EXISTS ONLY public.point_wallets DROP CONSTRAINT IF EXISTS point_wallets_pkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.point_recovery_claims DROP CONSTRAINT IF EXISTS point_recovery_claims_pkey;
ALTER TABLE IF EXISTS ONLY public.point_monthly_usage DROP CONSTRAINT IF EXISTS point_monthly_usage_pkey;
ALTER TABLE IF EXISTS ONLY public.point_monthly_cap_policies DROP CONSTRAINT IF EXISTS point_monthly_cap_policies_pkey;
ALTER TABLE IF EXISTS ONLY public.point_monthly_cap_policies DROP CONSTRAINT IF EXISTS point_monthly_cap_policies_effective_month_key;
ALTER TABLE IF EXISTS ONLY public.plan_adjustment_proposals DROP CONSTRAINT IF EXISTS plan_adjustment_proposals_run_id_goal_id_key;
ALTER TABLE IF EXISTS ONLY public.plan_adjustment_proposals DROP CONSTRAINT IF EXISTS plan_adjustment_proposals_pkey;
ALTER TABLE IF EXISTS ONLY public.phone_verification_challenges DROP CONSTRAINT IF EXISTS phone_verification_challenges_pkey;
ALTER TABLE IF EXISTS ONLY public.phone_credentials DROP CONSTRAINT IF EXISTS phone_credentials_pkey;
ALTER TABLE IF EXISTS ONLY public.phone_credentials DROP CONSTRAINT IF EXISTS phone_credentials_phone_e164_key;
ALTER TABLE IF EXISTS ONLY public.pet_stage_versions DROP CONSTRAINT IF EXISTS pet_stage_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_images DROP CONSTRAINT IF EXISTS pet_stage_images_r2_object_key_key;
ALTER TABLE IF EXISTS ONLY public.pet_stage_images DROP CONSTRAINT IF EXISTS pet_stage_images_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_stage_images DROP CONSTRAINT IF EXISTS pet_stage_images_id_species_id_key;
ALTER TABLE IF EXISTS ONLY public.pet_stage_dialogues DROP CONSTRAINT IF EXISTS pet_stage_dialogues_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_species_id_version_no_key;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_species_versions DROP CONSTRAINT IF EXISTS pet_species_versions_id_species_id_key;
ALTER TABLE IF EXISTS ONLY public.pet_species DROP CONSTRAINT IF EXISTS pet_species_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_species DROP CONSTRAINT IF EXISTS pet_species_code_key;
ALTER TABLE IF EXISTS ONLY public.pet_level_thresholds DROP CONSTRAINT IF EXISTS pet_level_thresholds_policy_version_id_min_total_xp_key;
ALTER TABLE IF EXISTS ONLY public.pet_level_thresholds DROP CONSTRAINT IF EXISTS pet_level_thresholds_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_level_policy_versions DROP CONSTRAINT IF EXISTS pet_level_policy_versions_version_no_key;
ALTER TABLE IF EXISTS ONLY public.pet_level_policy_versions DROP CONSTRAINT IF EXISTS pet_level_policy_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.pet_evolution_events DROP CONSTRAINT IF EXISTS pet_evolution_events_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_pet_experience DROP CONSTRAINT IF EXISTS pending_pet_experience_pkey;
ALTER TABLE IF EXISTS ONLY public.notices DROP CONSTRAINT IF EXISTS notices_pkey;
ALTER TABLE IF EXISTS ONLY public.notices DROP CONSTRAINT IF EXISTS notices_id_audience_type_key;
ALTER TABLE IF EXISTS ONLY public.notice_recipients DROP CONSTRAINT IF EXISTS notice_recipients_pkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_pkey;
ALTER TABLE IF EXISTS ONLY public.missions DROP CONSTRAINT IF EXISTS missions_id_user_id_uq;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_id_category_id_difficulty_id_key;
ALTER TABLE IF EXISTS ONLY public.mission_reward_rate_versions DROP CONSTRAINT IF EXISTS mission_reward_rate_versions_category_id_difficulty_id_vers_key;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_pkey;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_mission_id_submission_no_key;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_mission_id_attempt_no_key;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.mission_records DROP CONSTRAINT IF EXISTS mission_records_id_mission_id_key;
ALTER TABLE IF EXISTS ONLY public.mission_publication_reviews DROP CONSTRAINT IF EXISTS mission_publication_reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.mission_point_awards DROP CONSTRAINT IF EXISTS mission_point_awards_pkey;
ALTER TABLE IF EXISTS ONLY public.mission_point_awards DROP CONSTRAINT IF EXISTS mission_point_awards_mission_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_pkey;
ALTER TABLE IF EXISTS ONLY public.media_files DROP CONSTRAINT IF EXISTS media_files_pkey;
ALTER TABLE IF EXISTS ONLY public.media_files DROP CONSTRAINT IF EXISTS media_files_object_key_key;
ALTER TABLE IF EXISTS ONLY public.goals DROP CONSTRAINT IF EXISTS goals_pkey;
ALTER TABLE IF EXISTS ONLY public.goals DROP CONSTRAINT IF EXISTS goals_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.goal_steps DROP CONSTRAINT IF EXISTS goal_steps_pkey;
ALTER TABLE IF EXISTS ONLY public.goal_steps DROP CONSTRAINT IF EXISTS goal_steps_id_goal_id_key;
ALTER TABLE IF EXISTS ONLY public.goal_steps DROP CONSTRAINT IF EXISTS goal_steps_goal_id_step_no_key;
ALTER TABLE IF EXISTS ONLY public.goal_categories DROP CONSTRAINT IF EXISTS goal_categories_pkey;
ALTER TABLE IF EXISTS ONLY public.goal_categories DROP CONSTRAINT IF EXISTS goal_categories_name_key;
ALTER TABLE IF EXISTS ONLY public.goal_categories DROP CONSTRAINT IF EXISTS goal_categories_code_key;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.experience_transactions DROP CONSTRAINT IF EXISTS experience_transactions_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_user_id_source_type_source_id_key;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_pkey;
ALTER TABLE IF EXISTS ONLY public.experience_awards DROP CONSTRAINT IF EXISTS experience_awards_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.difficulty_levels DROP CONSTRAINT IF EXISTS difficulty_levels_pkey;
ALTER TABLE IF EXISTS ONLY public.difficulty_levels DROP CONSTRAINT IF EXISTS difficulty_levels_name_key;
ALTER TABLE IF EXISTS ONLY public.difficulty_levels DROP CONSTRAINT IF EXISTS difficulty_levels_code_key;
ALTER TABLE IF EXISTS ONLY public.consent_records DROP CONSTRAINT IF EXISTS consent_records_pkey;
ALTER TABLE IF EXISTS ONLY public.challenges DROP CONSTRAINT IF EXISTS challenges_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_runs DROP CONSTRAINT IF EXISTS challenge_settlement_runs_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_runs DROP CONSTRAINT IF EXISTS challenge_settlement_runs_id_challenge_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_runs DROP CONSTRAINT IF EXISTS challenge_settlement_runs_challenge_id_run_no_key;
ALTER TABLE IF EXISTS ONLY public.challenge_settlement_entries DROP CONSTRAINT IF EXISTS challenge_settlement_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_score_snapshots DROP CONSTRAINT IF EXISTS challenge_score_snapshots_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_rule_events DROP CONSTRAINT IF EXISTS challenge_rule_events_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_payment_attempts DROP CONSTRAINT IF EXISTS challenge_reward_payment_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_packages DROP CONSTRAINT IF EXISTS challenge_reward_packages_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_packages DROP CONSTRAINT IF EXISTS challenge_reward_packages_badge_achievement_version_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_participation_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_reward_grants DROP CONSTRAINT IF EXISTS challenge_reward_grants_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_publication_reviews DROP CONSTRAINT IF EXISTS challenge_publication_reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_id_challenge_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_id_challenge_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_participations DROP CONSTRAINT IF EXISTS challenge_participations_challenge_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_moderation_actions DROP CONSTRAINT IF EXISTS challenge_moderation_actions_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_final_rankings DROP CONSTRAINT IF EXISTS challenge_final_rankings_run_id_rank_no_key;
ALTER TABLE IF EXISTS ONLY public.challenge_final_rankings DROP CONSTRAINT IF EXISTS challenge_final_rankings_run_id_participation_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_final_rankings DROP CONSTRAINT IF EXISTS challenge_final_rankings_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_pkey;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_participation_id_challenge_date_key;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_mission_id_key;
ALTER TABLE IF EXISTS ONLY public.challenge_daily_missions DROP CONSTRAINT IF EXISTS challenge_daily_missions_id_participation_id_key;
ALTER TABLE IF EXISTS ONLY public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_refresh_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_reports DROP CONSTRAINT IF EXISTS ai_reports_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_plan_proposals DROP CONSTRAINT IF EXISTS ai_plan_proposals_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_plan_proposals DROP CONSTRAINT IF EXISTS ai_plan_proposals_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.ai_plan_proposals DROP CONSTRAINT IF EXISTS ai_plan_proposals_goal_id_generation_no_key;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_mission_recommendations_run_id_rank_no_key;
ALTER TABLE IF EXISTS ONLY public.ai_mission_recommendations DROP CONSTRAINT IF EXISTS ai_mission_recommendations_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_analysis_runs DROP CONSTRAINT IF EXISTS ai_analysis_runs_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_analysis_runs DROP CONSTRAINT IF EXISTS ai_analysis_runs_ingest_key_key;
ALTER TABLE IF EXISTS ONLY public.ai_analysis_runs DROP CONSTRAINT IF EXISTS ai_analysis_runs_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.ai_analysis_runs DROP CONSTRAINT IF EXISTS ai_analysis_runs_id_run_type_key;
ALTER TABLE IF EXISTS ONLY public.admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_refresh_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_idempotency_keys DROP CONSTRAINT IF EXISTS admin_idempotency_keys_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_idempotency_keys DROP CONSTRAINT IF EXISTS admin_idempotency_keys_admin_id_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_asset_uploads DROP CONSTRAINT IF EXISTS admin_asset_uploads_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_asset_uploads DROP CONSTRAINT IF EXISTS admin_asset_uploads_object_key_key;
ALTER TABLE IF EXISTS ONLY public.admin_accounts DROP CONSTRAINT IF EXISTS admin_accounts_pkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_id_achievement_id_key;
ALTER TABLE IF EXISTS ONLY public.achievement_versions DROP CONSTRAINT IF EXISTS achievement_versions_achievement_id_version_no_key;
ALTER TABLE IF EXISTS ONLY public.achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_pkey;
ALTER TABLE IF EXISTS ONLY public.achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_code_key;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_r2_object_key_key;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_pkey;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_id_achievement_id_key;
ALTER TABLE IF EXISTS ONLY public.achievement_badge_images DROP CONSTRAINT IF EXISTS achievement_badge_images_achievement_id_version_no_key;
ALTER TABLE IF EXISTS ONLY public.achievement_backfill_runs DROP CONSTRAINT IF EXISTS achievement_backfill_runs_version_id_key;
ALTER TABLE IF EXISTS ONLY public.achievement_backfill_runs DROP CONSTRAINT IF EXISTS achievement_backfill_runs_pkey;
ALTER TABLE IF EXISTS ONLY public.account_withdrawal_requests DROP CONSTRAINT IF EXISTS account_withdrawal_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.account_actions DROP CONSTRAINT IF EXISTS account_actions_pkey;
DROP TABLE IF EXISTS public.weather_observations;
DROP TABLE IF EXISTS public.weather_grid_cells;
DROP TABLE IF EXISTS public.verification_results;
DROP TABLE IF EXISTS public.verification_criteria_versions;
DROP TABLE IF EXISTS public.verification_appeals;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_pets;
DROP TABLE IF EXISTS public.user_notifications;
DROP TABLE IF EXISTS public.user_level_thresholds;
DROP TABLE IF EXISTS public.user_level_policy_versions;
DROP TABLE IF EXISTS public.user_inventory_events;
DROP TABLE IF EXISTS public.user_inventory;
DROP TABLE IF EXISTS public.user_identities;
DROP TABLE IF EXISTS public.user_idempotency_keys;
DROP TABLE IF EXISTS public.user_experience;
DROP TABLE IF EXISTS public.user_achievements;
DROP TABLE IF EXISTS public.user_achievement_events;
DROP TABLE IF EXISTS public.support_tickets;
DROP TABLE IF EXISTS public.support_ticket_resolutions;
DROP TABLE IF EXISTS public.support_ticket_events;
DROP TABLE IF EXISTS public.streak_states;
DROP TABLE IF EXISTS public.streak_milestone_policy_versions;
DROP TABLE IF EXISTS public.streak_milestone_awards;
DROP TABLE IF EXISTS public.streak_days;
DROP TABLE IF EXISTS public.shop_orders;
DROP TABLE IF EXISTS public.shop_items;
DROP TABLE IF EXISTS public.shop_item_price_versions;
DROP TABLE IF EXISTS public.schema_migrations;
DROP TABLE IF EXISTS public.recommendation_messages;
DROP TABLE IF EXISTS public.push_devices;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.policy_document_versions;
DROP TABLE IF EXISTS public.point_wallets;
DROP TABLE IF EXISTS public.point_transactions;
DROP TABLE IF EXISTS public.point_recovery_claims;
DROP TABLE IF EXISTS public.point_monthly_usage;
DROP TABLE IF EXISTS public.point_monthly_cap_policies;
DROP TABLE IF EXISTS public.plan_adjustment_proposals;
DROP TABLE IF EXISTS public.phone_verification_challenges;
DROP TABLE IF EXISTS public.phone_credentials;
DROP TABLE IF EXISTS public.pet_stage_versions;
DROP TABLE IF EXISTS public.pet_stage_images;
DROP TABLE IF EXISTS public.pet_stage_dialogues;
DROP TABLE IF EXISTS public.pet_species_versions;
DROP TABLE IF EXISTS public.pet_species;
DROP TABLE IF EXISTS public.pet_level_thresholds;
DROP TABLE IF EXISTS public.pet_level_policy_versions;
DROP TABLE IF EXISTS public.pet_evolution_events;
DROP TABLE IF EXISTS public.pending_pet_experience;
DROP TABLE IF EXISTS public.notices;
DROP TABLE IF EXISTS public.notice_recipients;
DROP TABLE IF EXISTS public.missions;
DROP TABLE IF EXISTS public.mission_reward_rate_versions;
DROP TABLE IF EXISTS public.mission_records;
DROP TABLE IF EXISTS public.mission_publication_reviews;
DROP TABLE IF EXISTS public.mission_point_awards;
DROP TABLE IF EXISTS public.mission_definitions;
DROP TABLE IF EXISTS public.media_files;
DROP TABLE IF EXISTS public.goals;
DROP TABLE IF EXISTS public.goal_steps;
DROP TABLE IF EXISTS public.goal_categories;
DROP TABLE IF EXISTS public.experience_transactions;
DROP TABLE IF EXISTS public.experience_awards;
DROP TABLE IF EXISTS public.difficulty_levels;
DROP TABLE IF EXISTS public.consent_records;
DROP TABLE IF EXISTS public.challenges;
DROP TABLE IF EXISTS public.challenge_settlement_runs;
DROP TABLE IF EXISTS public.challenge_settlement_entries;
DROP TABLE IF EXISTS public.challenge_score_snapshots;
DROP TABLE IF EXISTS public.challenge_rule_events;
DROP TABLE IF EXISTS public.challenge_reward_payment_attempts;
DROP TABLE IF EXISTS public.challenge_reward_packages;
DROP TABLE IF EXISTS public.challenge_reward_grants;
DROP TABLE IF EXISTS public.challenge_publication_reviews;
DROP TABLE IF EXISTS public.challenge_participations;
DROP TABLE IF EXISTS public.challenge_moderation_actions;
DROP VIEW IF EXISTS public.challenge_live_rankings;
DROP TABLE IF EXISTS public.challenge_final_rankings;
DROP TABLE IF EXISTS public.challenge_daily_missions;
DROP TABLE IF EXISTS public.auth_sessions;
DROP TABLE IF EXISTS public.ai_reports;
DROP TABLE IF EXISTS public.ai_plan_proposals;
DROP TABLE IF EXISTS public.ai_mission_recommendations;
DROP TABLE IF EXISTS public.ai_analysis_runs;
DROP TABLE IF EXISTS public.admin_sessions;
DROP TABLE IF EXISTS public.admin_idempotency_keys;
DROP TABLE IF EXISTS public.admin_audit_logs;
DROP TABLE IF EXISTS public.admin_asset_uploads;
DROP TABLE IF EXISTS public.admin_accounts;
DROP TABLE IF EXISTS public.achievement_versions;
DROP TABLE IF EXISTS public.achievement_definitions;
DROP TABLE IF EXISTS public.achievement_badge_images;
DROP TABLE IF EXISTS public.achievement_backfill_runs;
DROP TABLE IF EXISTS public.account_withdrawal_requests;
DROP TABLE IF EXISTS public.account_actions;
DROP FUNCTION IF EXISTS public.validate_verification_result_criteria();
DROP FUNCTION IF EXISTS public.validate_streak_success();
DROP FUNCTION IF EXISTS public.validate_mission_xp();
DROP FUNCTION IF EXISTS public.validate_mission_source();
DROP FUNCTION IF EXISTS public.validate_mission_reward();
DROP FUNCTION IF EXISTS public.snapshot_mission_pet();
DROP FUNCTION IF EXISTS public.scrub_user_mission_reviews();
DROP FUNCTION IF EXISTS public.scrub_user_challenge_logs();
DROP FUNCTION IF EXISTS public.scrub_user_account_logs();
DROP FUNCTION IF EXISTS public.require_r2_cleanup_before_user_delete();
DROP FUNCTION IF EXISTS public.reject_challenge_streak_day();
DROP FUNCTION IF EXISTS public.protect_xp_policy();
DROP FUNCTION IF EXISTS public.protect_verification_result();
DROP FUNCTION IF EXISTS public.protect_verification_criteria_version();
DROP FUNCTION IF EXISTS public.protect_user_pet_delete();
DROP FUNCTION IF EXISTS public.protect_user_achievement_event();
DROP FUNCTION IF EXISTS public.protect_user_achievement_delete();
DROP FUNCTION IF EXISTS public.protect_support_history();
DROP FUNCTION IF EXISTS public.protect_streak_milestone_policy();
DROP FUNCTION IF EXISTS public.protect_streak_milestone_award_delete();
DROP FUNCTION IF EXISTS public.protect_shop_price_version();
DROP FUNCTION IF EXISTS public.protect_point_transaction();
DROP FUNCTION IF EXISTS public.protect_mission_reward_rate();
DROP FUNCTION IF EXISTS public.protect_inventory_event();
DROP FUNCTION IF EXISTS public.protect_experience_transaction();
DROP FUNCTION IF EXISTS public.protect_badge_image();
DROP FUNCTION IF EXISTS public.protect_achievement_version();
DROP FUNCTION IF EXISTS public.lock_user_achievement_identity();
DROP FUNCTION IF EXISTS public.lock_streak_milestone_award_identity();
DROP FUNCTION IF EXISTS public.lock_started_mission_rules();
DROP FUNCTION IF EXISTS public.lock_mission_xp();
DROP FUNCTION IF EXISTS public.lock_mission_reward();
DROP FUNCTION IF EXISTS public.lock_mission_point_award_identity();
DROP FUNCTION IF EXISTS public.guard_verification_appeal();
DROP FUNCTION IF EXISTS public.guard_user_pet();
DROP FUNCTION IF EXISTS public.guard_user_notification_update();
DROP FUNCTION IF EXISTS public.guard_user_notification_insert();
DROP FUNCTION IF EXISTS public.guard_user_idempotency_key();
DROP FUNCTION IF EXISTS public.guard_user_experience();
DROP FUNCTION IF EXISTS public.guard_user_achievement_paid_points();
DROP FUNCTION IF EXISTS public.guard_user_achievement_event();
DROP FUNCTION IF EXISTS public.guard_user_achievement();
DROP FUNCTION IF EXISTS public.guard_support_ticket_update();
DROP FUNCTION IF EXISTS public.guard_support_resolution_update();
DROP FUNCTION IF EXISTS public.guard_support_resolution();
DROP FUNCTION IF EXISTS public.guard_streak_point_source();
DROP FUNCTION IF EXISTS public.guard_streak_milestone_award();
DROP FUNCTION IF EXISTS public.guard_shop_order_update();
DROP FUNCTION IF EXISTS public.guard_shop_order_insert();
DROP FUNCTION IF EXISTS public.guard_representative_badge();
DROP FUNCTION IF EXISTS public.guard_point_transaction();
DROP FUNCTION IF EXISTS public.guard_point_recovery_claim_source();
DROP FUNCTION IF EXISTS public.guard_point_cap_policy();
DROP FUNCTION IF EXISTS public.guard_notice_update();
DROP FUNCTION IF EXISTS public.guard_notice_recipients();
DROP FUNCTION IF EXISTS public.guard_notice_delete();
DROP FUNCTION IF EXISTS public.guard_mission_record_write();
DROP FUNCTION IF EXISTS public.guard_mission_point_award();
DROP FUNCTION IF EXISTS public.guard_experience_award();
DROP FUNCTION IF EXISTS public.guard_challenge_settlement_run();
DROP FUNCTION IF EXISTS public.guard_challenge_settlement_entry();
DROP FUNCTION IF EXISTS public.guard_challenge_reward_package();
DROP FUNCTION IF EXISTS public.guard_challenge_reward_grant();
DROP FUNCTION IF EXISTS public.guard_challenge_point_source();
DROP FUNCTION IF EXISTS public.guard_challenge_point_recovery_claim();
DROP FUNCTION IF EXISTS public.guard_challenge_participation();
DROP FUNCTION IF EXISTS public.guard_challenge_final_ranking();
DROP FUNCTION IF EXISTS public.guard_challenge_daily_mission();
DROP FUNCTION IF EXISTS public.guard_challenge();
DROP FUNCTION IF EXISTS public.guard_ai_run_update();
DROP FUNCTION IF EXISTS public.guard_ai_result_insert();
DROP FUNCTION IF EXISTS public.guard_ai_report_update();
DROP FUNCTION IF EXISTS public.guard_ai_decision_update();
DROP FUNCTION IF EXISTS public.guard_admin_idempotency_key();
DROP FUNCTION IF EXISTS public.guard_achievement_point_source();
DROP FUNCTION IF EXISTS public.delete_user_inquiries();
DROP FUNCTION IF EXISTS public.clear_revoked_representative_badge();
DROP FUNCTION IF EXISTS public.check_xp_threshold_sequence();
DROP FUNCTION IF EXISTS public.check_pet_stage_sequence();
DROP FUNCTION IF EXISTS public.cancel_unstarted_missions_for_deleted_goal();
DROP FUNCTION IF EXISTS public.apply_inventory_event();
DROP FUNCTION IF EXISTS public.anonymize_challenge_ranking();
--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: anonymize_challenge_ranking(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anonymize_challenge_ranking() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE challenge_final_rankings SET participation_id=NULL,
           display_name='탈퇴 회원',anonymized_at=now()
     WHERE participation_id=OLD.id;
    RETURN OLD;
END $$;


--
-- Name: apply_inventory_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_inventory_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- UPDATE 먼저: INSERT ... ON CONFLICT는 충돌 판정 전에 원본 증감값으로 CHECK를 평가함
    UPDATE user_inventory
       SET quantity = quantity + NEW.quantity_delta, updated_at = NEW.occurred_at
     WHERE user_id = NEW.user_id AND item_id = NEW.item_id;
    IF NOT FOUND THEN
        IF NEW.quantity_delta < 0 THEN
            RAISE EXCEPTION 'inventory cannot go below zero'
                USING ERRCODE = '23514';
        END IF;
        INSERT INTO user_inventory (user_id, item_id, quantity, updated_at)
        VALUES (NEW.user_id, NEW.item_id, NEW.quantity_delta, NEW.occurred_at)
        ON CONFLICT (user_id, item_id) DO UPDATE
           SET quantity = user_inventory.quantity + EXCLUDED.quantity,
               updated_at = EXCLUDED.updated_at;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: cancel_unstarted_missions_for_deleted_goal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_unstarted_missions_for_deleted_goal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE missions
           SET status = 'cancelled',
               cancel_reason = 'goal_deleted',
               cancelled_at = NEW.deleted_at,
               deleted_at = NEW.deleted_at,
               updated_at = now()
         WHERE goal_id = NEW.id
           AND status = 'scheduled'
           AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_pet_stage_sequence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_pet_stage_sequence() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE previous_xp bigint;
BEGIN
    IF NEW.stage_no=1 THEN RETURN NEW; END IF;
    SELECT min_total_xp INTO previous_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=NEW.stage_no-1;
    IF previous_xp IS NULL OR NEW.min_total_xp<=previous_xp THEN
        RAISE EXCEPTION 'pet stages require contiguous, increasing XP' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: check_xp_threshold_sequence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_xp_threshold_sequence() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE prior_xp bigint;
BEGIN
    IF NEW.level_no=1 THEN RETURN NEW; END IF;
    EXECUTE format('SELECT min_total_xp FROM %I WHERE policy_version_id=$1 AND level_no=$2', TG_TABLE_NAME)
       INTO prior_xp USING NEW.policy_version_id, NEW.level_no-1;
    IF prior_xp IS NULL OR NEW.min_total_xp <= prior_xp THEN
        RAISE EXCEPTION 'XP thresholds require contiguous, increasing levels' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $_$;


--
-- Name: clear_revoked_representative_badge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_revoked_representative_badge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'revoked' THEN
        UPDATE profiles SET representative_achievement_id = NULL
         WHERE user_id = NEW.user_id
           AND representative_achievement_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: delete_user_inquiries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_inquiries() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM support_tickets
     WHERE reporter_user_id = OLD.id AND ticket_type = 'inquiry';
    RETURN OLD;
END;
$$;


--
-- Name: guard_achievement_point_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_achievement_point_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.source_type = 'achievement' AND NOT EXISTS (
        SELECT 1 FROM user_achievements
         WHERE id = NEW.source_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'achievement point source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_admin_idempotency_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_admin_idempotency_key() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.admin_id, OLD.idempotency_key, OLD.operation,
           OLD.request_hash, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.admin_id, NEW.idempotency_key, NEW.operation,
           NEW.request_hash, NEW.created_at) THEN
        RAISE EXCEPTION 'idempotency request identity is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'completed idempotency key cannot reopen'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_ai_decision_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_ai_decision_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF to_jsonb(OLD) - 'status' - 'decided_at' - 'accepted_plan_json'
       IS DISTINCT FROM
       to_jsonb(NEW) - 'status' - 'decided_at' - 'accepted_plan_json' THEN
        RAISE EXCEPTION 'AI result content is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> NEW.status AND OLD.status NOT IN ('proposed', 'shown') THEN
        RAISE EXCEPTION 'decision is final' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_ai_report_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_ai_report_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF to_jsonb(OLD) - 'read_at' IS DISTINCT FROM to_jsonb(NEW) - 'read_at'
       OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) THEN
        RAISE EXCEPTION 'report content is immutable; read time is set once'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_ai_result_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_ai_result_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    run_status varchar(10);
BEGIN
    SELECT status INTO run_status FROM ai_analysis_runs WHERE id = NEW.run_id;
    IF run_status IS DISTINCT FROM 'requested' THEN
        RAISE EXCEPTION 'results attach only to an open analysis run'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_ai_run_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_ai_run_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    has_result boolean;
BEGIN
    IF ROW(OLD.user_id, OLD.run_type, OLD.period_start, OLD.period_end,
           OLD.requested_at, OLD.generation_no)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.run_type, NEW.period_start, NEW.period_end,
           NEW.requested_at, NEW.generation_no) THEN
        RAISE EXCEPTION 'analysis run identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'requested' AND
       ROW(OLD.status, OLD.engine_version, OLD.ingest_key, OLD.failure_reason,
           OLD.completed_at)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.engine_version, NEW.ingest_key, NEW.failure_reason,
           NEW.completed_at) THEN
        RAISE EXCEPTION 'finished analysis run cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.superseded_at IS NOT NULL AND
       NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
        RAISE EXCEPTION 'supersession is recorded once' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'requested' AND NEW.status = 'completed' THEN
        has_result := CASE NEW.run_type
            WHEN 'plan_adjustment' THEN EXISTS (SELECT 1 FROM plan_adjustment_proposals WHERE run_id = NEW.id)
            WHEN 'situational_recommendation' THEN EXISTS (SELECT 1 FROM ai_mission_recommendations WHERE run_id = NEW.id)
            ELSE EXISTS (SELECT 1 FROM ai_reports WHERE run_id = NEW.id)
        END;
        IF NOT has_result THEN
            RAISE EXCEPTION 'a completed run needs its result' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_challenge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP='INSERT' THEN
        IF NEW.publication_status='public' AND NEW.start_date<=(now() AT TIME ZONE 'Asia/Seoul')::date THEN
            RAISE EXCEPTION 'challenge must publish before start day' USING ERRCODE='23514';
        END IF;
    ELSE
        IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
            RAISE EXCEPTION 'challenge publication time is immutable' USING ERRCODE='23514';
        END IF;
        IF OLD.publication_status='public' AND NEW.publication_status<>'public'
           AND NEW.publication_status NOT IN ('hidden','cancelled') THEN
            RAISE EXCEPTION 'published challenge cannot return to draft' USING ERRCODE='23514';
        END IF;
        IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
           AND NEW.start_date<=(now() AT TIME ZONE 'Asia/Seoul')::date THEN
            RAISE EXCEPTION 'challenge must publish before start day' USING ERRCODE='23514';
        END IF;
        IF EXISTS(SELECT 1 FROM challenge_participations WHERE challenge_id=OLD.id) AND
           ROW(OLD.origin,OLD.title,OLD.description,OLD.category_id,OLD.difficulty_id,
               OLD.verification_method,OLD.target_value,OLD.target_unit,
               OLD.estimated_duration_seconds,OLD.start_date,OLD.end_date,
               OLD.required_success_days,OLD.max_participants)
           IS DISTINCT FROM ROW(NEW.origin,NEW.title,NEW.description,NEW.category_id,NEW.difficulty_id,
               NEW.verification_method,NEW.target_value,NEW.target_unit,
               NEW.estimated_duration_seconds,NEW.start_date,NEW.end_date,
               NEW.required_success_days,NEW.max_participants) THEN
            RAISE EXCEPTION 'challenge rules locked after first enrollment' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_daily_mission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_daily_mission() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE start_day date; end_day date; mission_row missions%ROWTYPE;
        challenge_row challenges%ROWTYPE;
        participation_status text;
        evidence_submitted timestamptz; evidence_decision text; evidence_current boolean;
BEGIN
    SELECT * INTO challenge_row FROM challenges WHERE id=NEW.challenge_id;
    start_day:=challenge_row.start_date;
    end_day:=challenge_row.end_date;
    SELECT status INTO participation_status FROM challenge_participations WHERE id=NEW.participation_id;
    IF TG_OP='INSERT' AND participation_status<>'enrolled' THEN
        RAISE EXCEPTION 'daily missions require enrolled participant' USING ERRCODE='23514';
    END IF;
    SELECT * INTO mission_row FROM missions WHERE id=NEW.mission_id;
    IF NEW.challenge_date<start_day OR NEW.challenge_date>end_day
       OR mission_row.source_type IS DISTINCT FROM 'challenge'
       OR mission_row.scheduled_date IS DISTINCT FROM NEW.challenge_date
       OR ROW(mission_row.category_id,mission_row.difficulty_id,mission_row.verification_method,
              mission_row.target_value,mission_row.target_unit,mission_row.estimated_duration_seconds)
          IS DISTINCT FROM ROW(challenge_row.category_id,challenge_row.difficulty_id,
              challenge_row.verification_method,challenge_row.target_value,
              challenge_row.target_unit,challenge_row.estimated_duration_seconds)
       OR mission_row.reward_points<>0 OR mission_row.reward_user_xp<>0 OR mission_row.reward_pet_xp<>0 THEN
        RAISE EXCEPTION 'daily challenge mission must match challenge and carry no daily reward' USING ERRCODE='23514';
    END IF;
    IF NEW.status='success' THEN
        SELECT mr.submitted_at,vr.decision,vr.is_current
          INTO evidence_submitted,evidence_decision,evidence_current
          FROM mission_records mr JOIN verification_results vr ON vr.record_id=mr.id
         WHERE mr.id=NEW.qualifying_record_id AND vr.id=NEW.qualifying_result_id;
        IF evidence_submitted IS NULL OR
           evidence_submitted >= ((NEW.challenge_date+1)::timestamp AT TIME ZONE 'Asia/Seoul')
           OR (evidence_submitted AT TIME ZONE 'Asia/Seoul')::date<>NEW.challenge_date
           OR evidence_decision<>'approved' OR NOT evidence_current THEN
            RAISE EXCEPTION 'challenge success needs timely current approval' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_final_ranking(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_final_ranking() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE entry_rank integer; entry_score integer; profile_name text;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.run_id,OLD.rank_no,OLD.score)
           IS DISTINCT FROM ROW(NEW.run_id,NEW.rank_no,NEW.score) OR
           (OLD.participation_id IS NULL AND NEW.participation_id IS NOT NULL) THEN
            RAISE EXCEPTION 'final ranking history is immutable' USING ERRCODE='23514';
        END IF;
        IF OLD.participation_id IS NOT NULL AND NEW.participation_id IS NULL AND
           (NEW.display_name<>'탈퇴 회원' OR NEW.anonymized_at IS NULL) THEN
            RAISE EXCEPTION 'deleted participant must be anonymized' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    SELECT e.rank_no,e.score,pf.nickname INTO entry_rank,entry_score,profile_name
      FROM challenge_settlement_entries e
      JOIN challenge_participations cp ON cp.id=e.participation_id
      JOIN profiles pf ON pf.user_id=cp.user_id
     WHERE e.run_id=NEW.run_id AND e.participation_id=NEW.participation_id;
    IF entry_rank IS DISTINCT FROM NEW.rank_no OR entry_score IS DISTINCT FROM NEW.score OR
       profile_name IS DISTINCT FROM NEW.display_name THEN
        RAISE EXCEPTION 'final ranking must match settlement and current nickname' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_participation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_participation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE start_day date; public_status text; cap integer; active_count integer;
        public_at timestamptz;
BEGIN
    SELECT start_date,publication_status,max_participants,published_at
      INTO start_day,public_status,cap,public_at
      FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.challenge_id,OLD.user_id) IS DISTINCT FROM ROW(NEW.challenge_id,NEW.user_id) THEN
            RAISE EXCEPTION 'participation identity cannot change' USING ERRCODE='23514';
        END IF;
        IF OLD.status='withdrawn' AND NEW.status='enrolled' AND
           (OLD.withdrawn_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')
            OR NEW.joined_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')) THEN
            RAISE EXCEPTION 'cannot rejoin after challenge starts' USING ERRCODE='23514';
        END IF;
        IF OLD.status IN ('disqualified','completed','failed') AND NEW.status='enrolled' THEN
            RAISE EXCEPTION 'final participation cannot rejoin' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.status='enrolled' AND (TG_OP='INSERT' OR OLD.status<>'enrolled') THEN
        IF public_status<>'public' OR NEW.joined_at<public_at OR NEW.joined_at>now()
           OR NEW.joined_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')
           OR (now() AT TIME ZONE 'Asia/Seoul')::date>=start_day
           OR NOT EXISTS(SELECT 1 FROM challenge_reward_packages WHERE challenge_id=NEW.challenge_id)
           OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active') THEN
            RAISE EXCEPTION 'challenge is not open for enrollment' USING ERRCODE='23514';
        END IF;
        SELECT count(*) INTO active_count FROM challenge_participations
         WHERE challenge_id=NEW.challenge_id AND status='enrolled' AND id<>NEW.id;
        IF cap IS NOT NULL AND active_count>=cap THEN
            RAISE EXCEPTION 'challenge is full' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_point_recovery_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_point_recovery_claim() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.challenge_reward_grant_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM point_transactions pt
         WHERE pt.id=NEW.original_award_transaction_id AND pt.user_id=NEW.user_id
           AND pt.source_type='challenge' AND pt.source_id=NEW.challenge_reward_grant_id
           AND pt.kind='auto_award') THEN
        RAISE EXCEPTION 'challenge recovery must reference its original point award'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_point_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_point_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.source_type='challenge' AND NOT EXISTS(
        SELECT 1 FROM challenge_reward_grants
         WHERE id=NEW.source_id AND user_id=NEW.user_id) THEN
        RAISE EXCEPTION 'challenge point source must belong to user' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_reward_grant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_reward_grant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE pkg challenge_reward_packages%ROWTYPE; run_status text;
        entry_paid integer; badge_version uuid;
BEGIN
    SELECT * INTO pkg FROM challenge_reward_packages WHERE challenge_id=NEW.challenge_id;
    SELECT status INTO run_status FROM challenge_settlement_runs WHERE id=NEW.first_settlement_run_id;
    IF TG_OP='INSERT' THEN
        SELECT paid_points INTO entry_paid FROM challenge_settlement_entries
         WHERE run_id=NEW.first_settlement_run_id AND participation_id=NEW.participation_id;
        IF run_status<>'confirmed' OR pkg.points IS DISTINCT FROM NEW.promised_points
           OR pkg.user_xp IS DISTINCT FROM NEW.user_xp OR pkg.pet_xp IS DISTINCT FROM NEW.pet_xp
           OR entry_paid IS DISTINCT FROM NEW.paid_points
           OR NOT EXISTS(SELECT 1 FROM challenge_settlement_entries e
              WHERE e.run_id=NEW.first_settlement_run_id AND e.participation_id=NEW.participation_id
                AND e.outcome='completed') THEN
            RAISE EXCEPTION 'reward requires confirmed completed settlement' USING ERRCODE='23514';
        END IF;
    ELSE
        IF ROW(OLD.participation_id,OLD.challenge_id,OLD.user_id,OLD.first_settlement_run_id,
               OLD.promised_points,OLD.paid_points,OLD.user_xp,OLD.pet_xp,OLD.recipient_pet_id)
           IS DISTINCT FROM ROW(NEW.participation_id,NEW.challenge_id,NEW.user_id,NEW.first_settlement_run_id,
               NEW.promised_points,NEW.paid_points,NEW.user_xp,NEW.pet_xp,NEW.recipient_pet_id) THEN
            RAISE EXCEPTION 'reward grant identity and amounts are immutable' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.badge_grant_id IS NOT NULL THEN
        SELECT achievement_version_id INTO badge_version FROM user_achievements
         WHERE id=NEW.badge_grant_id AND user_id=NEW.user_id;
        IF badge_version IS DISTINCT FROM pkg.badge_achievement_version_id THEN
            RAISE EXCEPTION 'challenge badge grant must match reward package' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_reward_package(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_reward_package() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE challenge_origin text; challenge_status text;
BEGIN
    SELECT origin,publication_status INTO challenge_origin,challenge_status
      FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
    IF challenge_origin='user' AND
       (NEW.points<>0 OR NEW.user_xp<>0 OR NEW.pet_xp<>0 OR NEW.badge_achievement_version_id IS NOT NULL) THEN
        RAISE EXCEPTION 'community challenge cannot grant currency or badges' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM challenge_participations WHERE challenge_id=NEW.challenge_id) THEN
        RAISE EXCEPTION 'challenge reward locked after first enrollment' USING ERRCODE='23514';
    END IF;
    IF NEW.badge_achievement_version_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM achievement_versions av WHERE av.id=NEW.badge_achievement_version_id
          AND av.condition_type='challenge_completed' AND av.reward_points=0
          AND av.reward_user_xp=0 AND av.reward_pet_xp=0) THEN
        RAISE EXCEPTION 'challenge badge must be a zero-reward challenge achievement' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_settlement_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_settlement_entry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE run_status text; required_days integer; package_points integer;
        package_user_xp integer; package_pet_xp integer;
        actual_days integer; last_submission timestamptz;
BEGIN
    SELECT status INTO run_status FROM challenge_settlement_runs WHERE id=NEW.run_id;
    IF TG_OP='UPDATE' AND run_status<>'draft' AND
       ROW(OLD.run_id,OLD.challenge_id,OLD.participation_id,OLD.successful_days,
           OLD.last_qualifying_submitted_at,OLD.rank_no,OLD.outcome,
           OLD.exclusion_reason,OLD.promised_points,OLD.user_xp,OLD.pet_xp)
       IS DISTINCT FROM ROW(NEW.run_id,NEW.challenge_id,NEW.participation_id,NEW.successful_days,
           NEW.last_qualifying_submitted_at,NEW.rank_no,NEW.outcome,
           NEW.exclusion_reason,NEW.promised_points,NEW.user_xp,NEW.pet_xp) THEN
        RAISE EXCEPTION 'confirmed settlement result is immutable' USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' AND run_status<>'draft' THEN
        RAISE EXCEPTION 'settlement entries must be prepared in a draft' USING ERRCODE='23514';
    END IF;
    SELECT c.required_success_days,p.points,p.user_xp,p.pet_xp
      INTO required_days,package_points,package_user_xp,package_pet_xp
      FROM challenges c JOIN challenge_reward_packages p ON p.challenge_id=c.id
     WHERE c.id=NEW.challenge_id;
    SELECT count(*) INTO actual_days FROM challenge_daily_missions
     WHERE participation_id=NEW.participation_id AND status='success';
    SELECT mr.submitted_at INTO last_submission
      FROM challenge_daily_missions d
      JOIN mission_records mr ON mr.id=d.qualifying_record_id
     WHERE d.participation_id=NEW.participation_id AND d.status='success'
     ORDER BY d.challenge_date DESC LIMIT 1;
    IF actual_days<>NEW.successful_days OR
       last_submission IS DISTINCT FROM NEW.last_qualifying_submitted_at THEN
        RAISE EXCEPTION 'settlement score must match current daily evidence' USING ERRCODE='23514';
    END IF;
    IF NEW.outcome='completed' AND
       (NEW.successful_days<required_days OR NEW.promised_points<>package_points
        OR NEW.user_xp<>package_user_xp OR NEW.pet_xp<>package_pet_xp) THEN
        RAISE EXCEPTION 'completed result must match challenge threshold and reward package' USING ERRCODE='23514';
    END IF;
    IF NEW.outcome='failed' AND NEW.successful_days>=required_days THEN
        RAISE EXCEPTION 'qualifying participant cannot be marked failed' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_challenge_settlement_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_challenge_settlement_run() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE end_day date;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF OLD.status='superseded' OR (OLD.status='confirmed' AND NEW.status<>'superseded') THEN
            RAISE EXCEPTION 'settlement status cannot go backward' USING ERRCODE='23514';
        END IF;
        IF ROW(OLD.challenge_id,OLD.run_no,OLD.based_on_at,OLD.confirmed_by_admin_id,
               OLD.confirmed_at,OLD.reason)
           IS DISTINCT FROM ROW(NEW.challenge_id,NEW.run_no,NEW.based_on_at,NEW.confirmed_by_admin_id,
               NEW.confirmed_at,NEW.reason) AND OLD.status<>'draft' THEN
            RAISE EXCEPTION 'confirmed settlement header is immutable' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.status='confirmed' AND (TG_OP='INSERT' OR OLD.status<>'confirmed') THEN
        SELECT end_date INTO end_day FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
        IF (now() AT TIME ZONE 'Asia/Seoul')::date<=end_day OR
           EXISTS(SELECT 1 FROM challenge_daily_missions d
                   WHERE d.challenge_id=NEW.challenge_id AND d.status='pending') OR
           EXISTS(SELECT 1 FROM challenge_daily_missions d
                  JOIN mission_records mr ON mr.mission_id=d.mission_id
                  WHERE d.challenge_id=NEW.challenge_id
                    AND mr.submitted_at<((d.challenge_date+1)::timestamp AT TIME ZONE 'Asia/Seoul')
                    AND (mr.status IN ('submitted','review_required')
                         OR EXISTS(SELECT 1 FROM verification_appeals va
                                   WHERE va.record_id=mr.id AND va.status='open'))) OR
           EXISTS(SELECT 1 FROM challenge_participations p
                  WHERE p.challenge_id=NEW.challenge_id AND
                    (SELECT count(*) FROM challenge_daily_missions d
                      WHERE d.participation_id=p.id)<>
                    (SELECT end_date-start_date+1 FROM challenges c WHERE c.id=NEW.challenge_id)) OR
           EXISTS(SELECT 1 FROM challenge_participations p
                   WHERE p.challenge_id=NEW.challenge_id AND NOT EXISTS(
                     SELECT 1 FROM challenge_settlement_entries e
                     WHERE e.run_id=NEW.id AND e.participation_id=p.id)) THEN
            RAISE EXCEPTION 'settlement cannot confirm before end or while results are pending'
                USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_experience_award(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_experience_award() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE expected_user_xp integer; expected_pet_xp integer;
        source_status text; source_user uuid; snapshot_pet uuid;
        snapshot_stage smallint; snapshot_bonus integer;
        snapshot_species_version uuid;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.user_id,OLD.source_type,OLD.source_id,OLD.base_user_xp,OLD.base_pet_xp,OLD.bonus_pet_xp)
           IS DISTINCT FROM ROW(NEW.user_id,NEW.source_type,NEW.source_id,NEW.base_user_xp,NEW.base_pet_xp,NEW.bonus_pet_xp)
        THEN
            RAISE EXCEPTION 'XP award source and amount are fixed' USING ERRCODE='23514';
        END IF;
        IF OLD.recipient_pet_id IS NOT NULL THEN
            IF ROW(OLD.recipient_pet_id,OLD.pet_species_version_id,OLD.pet_stage_no,OLD.bonus_basis_points)
               IS DISTINCT FROM ROW(NEW.recipient_pet_id,NEW.pet_species_version_id,NEW.pet_stage_no,NEW.bonus_basis_points)
            THEN
                RAISE EXCEPTION 'XP award recipient is fixed once assigned' USING ERRCODE='23514';
            END IF;
        ELSIF NEW.recipient_pet_id IS NOT NULL AND NEW.bonus_basis_points<>0 THEN
            RAISE EXCEPTION 'pending XP assignment cannot carry a buff' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.source_type='mission' THEN
        SELECT user_id,status,reward_user_xp,reward_pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM missions WHERE id=NEW.source_id;
        SELECT mr.reward_pet_id,mr.reward_pet_stage_no,mr.reward_pet_bonus_basis_points,
               up.species_version_id
          INTO snapshot_pet,snapshot_stage,snapshot_bonus,snapshot_species_version
          FROM mission_records mr
          JOIN verification_results vr ON vr.record_id=mr.id
          LEFT JOIN user_pets up ON up.id=mr.reward_pet_id
         WHERE mr.mission_id=NEW.source_id AND vr.decision='approved' AND vr.is_current
         ORDER BY mr.submitted_at DESC LIMIT 1;
        IF snapshot_pet IS DISTINCT FROM NEW.recipient_pet_id OR
           snapshot_stage IS DISTINCT FROM NEW.pet_stage_no OR
           snapshot_species_version IS DISTINCT FROM NEW.pet_species_version_id OR
           COALESCE(snapshot_bonus,0) IS DISTINCT FROM NEW.bonus_basis_points THEN
            RAISE EXCEPTION 'XP award must use mission start pet snapshot' USING ERRCODE='23514';
        END IF;
    ELSIF NEW.source_type='achievement' THEN
        SELECT ua.user_id,ua.status,av.reward_user_xp,av.reward_pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM user_achievements ua JOIN achievement_versions av ON av.id=ua.achievement_version_id
         WHERE ua.id=NEW.source_id;
    ELSIF NEW.source_type='streak' THEN
        SELECT sma.user_id,sma.status,sp.user_xp,sp.pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM streak_milestone_awards sma
          JOIN streak_milestone_policy_versions sp ON sp.id=sma.policy_version_id
         WHERE sma.id=NEW.source_id;
    ELSE
        SELECT crg.user_id,crg.status,crg.user_xp,crg.pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM challenge_reward_grants crg WHERE crg.id=NEW.source_id;
        IF NEW.recipient_pet_id IS DISTINCT FROM
             (SELECT recipient_pet_id FROM challenge_reward_grants WHERE id=NEW.source_id) THEN
            RAISE EXCEPTION 'challenge XP must retain settlement pet recipient' USING ERRCODE='23514';
        END IF;
    END IF;
    IF source_user IS DISTINCT FROM NEW.user_id OR
       source_status IS DISTINCT FROM (CASE WHEN NEW.source_type='mission' THEN 'completed' ELSE 'active' END) OR
       expected_user_xp IS DISTINCT FROM NEW.base_user_xp OR
       expected_pet_xp IS DISTINCT FROM NEW.base_pet_xp OR
       (NEW.source_type='mission' AND NOT EXISTS (
            SELECT 1 FROM mission_records mr JOIN verification_results vr ON vr.record_id=mr.id
             WHERE mr.mission_id=NEW.source_id AND vr.decision='approved' AND vr.is_current)) THEN
        RAISE EXCEPTION 'XP award requires an active matching source' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_mission_point_award(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mission_point_award() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    expected_points integer;
    result_mission_id uuid;
    result_decision varchar(20);
    result_is_current boolean;
BEGIN
    SELECT reward_points INTO expected_points
      FROM missions WHERE id = NEW.mission_id AND user_id = NEW.user_id;
    SELECT mr.mission_id, vr.decision, vr.is_current
      INTO result_mission_id, result_decision, result_is_current
      FROM verification_results vr
      JOIN mission_records mr ON mr.id = vr.record_id
     WHERE vr.id = NEW.first_approved_result_id;
    IF expected_points IS NULL OR expected_points <> NEW.original_points OR
       result_mission_id IS DISTINCT FROM NEW.mission_id OR
       result_decision IS DISTINCT FROM 'approved' OR
       result_is_current IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'mission award requires its own approved result and fixed reward'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_mission_record_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mission_record_write() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    mission_status varchar(20);
    mission_method varchar(30);
    mission_deleted_at timestamptz;
BEGIN
    SELECT status, verification_method, deleted_at
      INTO mission_status, mission_method, mission_deleted_at
      FROM missions
     WHERE id = NEW.mission_id AND user_id = NEW.user_id
     FOR UPDATE;

    IF mission_status IS NULL THEN
        RAISE EXCEPTION 'mission does not belong to this user'
            USING ERRCODE = '23503';
    END IF;

    IF (mission_status IN ('completed', 'cancelled')
        OR mission_deleted_at IS NOT NULL) AND
       (TG_OP = 'INSERT' OR
        (OLD.submission_no IS NULL AND NEW.submission_no IS NOT NULL)) THEN
        RAISE EXCEPTION 'closed mission cannot accept another attempt'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND
       ROW(OLD.mission_id, OLD.user_id, OLD.attempt_no, OLD.started_at)
       IS DISTINCT FROM
       ROW(NEW.mission_id, NEW.user_id, NEW.attempt_no, NEW.started_at) THEN
        RAISE EXCEPTION 'attempt identity is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.submission_no IS NOT NULL AND
       NEW.evidence_kind IS DISTINCT FROM OLD.evidence_kind THEN
        RAISE EXCEPTION 'submitted evidence kind is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.submission_no IS NOT NULL AND
       NEW.submission_no IS DISTINCT FROM OLD.submission_no THEN
        RAISE EXCEPTION 'submission number is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.submission_no IS NOT NULL AND
       (TG_OP = 'INSERT' OR OLD.submission_no IS NULL) THEN
        IF (mission_method = 'camera' AND
                NEW.evidence_kind IS DISTINCT FROM 'camera_media')
           OR (mission_method = 'sensor' AND
                NEW.evidence_kind NOT IN ('sensor_raw', 'sensor_summary')) THEN
            RAISE EXCEPTION 'evidence kind does not match mission method'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.evidence_kind IN ('camera_media', 'sensor_raw') AND
           NOT EXISTS (
               SELECT 1 FROM media_files
                WHERE record_id = NEW.id AND upload_status = 'uploaded'
                  AND ((NEW.evidence_kind = 'camera_media' AND
                        media_kind IN ('camera_photo', 'camera_video'))
                    OR (NEW.evidence_kind = 'sensor_raw' AND
                        media_kind = 'sensor_raw'))
           ) THEN
            RAISE EXCEPTION 'verified R2 evidence is required before submission'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: guard_notice_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_notice_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION 'only draft notices can be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: guard_notice_recipients(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_notice_recipients() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    notice_status varchar(12);
    member_exists boolean;
    notice_exists boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT status INTO notice_status FROM notices WHERE id = NEW.notice_id;
        IF notice_status IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'recipients change only while the notice is a draft'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    SELECT status INTO notice_status FROM notices WHERE id = OLD.notice_id;
    notice_exists := FOUND;
    SELECT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) INTO member_exists;
    IF NOT notice_exists OR NOT member_exists OR notice_status = 'draft' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'recipients change only while the notice is a draft'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: guard_notice_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_notice_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status <> 'draft' AND
       ROW(OLD.category, OLD.title, OLD.body, OLD.link_screen, OLD.audience_type,
           OLD.show_in_list, OLD.send_push, OLD.policy_document_version_id,
           OLD.created_by_admin_id, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.category, NEW.title, NEW.body, NEW.link_screen, NEW.audience_type,
           NEW.show_in_list, NEW.send_push, NEW.policy_document_version_id,
           NEW.created_by_admin_id, NEW.created_at) THEN
        RAISE EXCEPTION 'notice content is frozen after scheduling'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'draft' AND NEW.status IN ('scheduled', 'published', 'cancelled')) OR
        (OLD.status = 'scheduled' AND NEW.status IN ('published', 'cancelled'))) THEN
        RAISE EXCEPTION 'invalid notice status transition' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'draft' AND NEW.status IN ('scheduled', 'published') AND
       NEW.audience_type = 'users' AND NOT EXISTS (
           SELECT 1 FROM notice_recipients WHERE notice_id = NEW.id) THEN
        RAISE EXCEPTION 'targeted notice needs recipients' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IN ('published', 'cancelled') AND
       ROW(OLD.status, OLD.scheduled_at, OLD.published_at, OLD.cancelled_at)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.scheduled_at, NEW.published_at, NEW.cancelled_at) THEN
        RAISE EXCEPTION 'finished notice cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.fanout_completed_at IS NOT NULL AND
       NEW.fanout_completed_at IS DISTINCT FROM OLD.fanout_completed_at THEN
        RAISE EXCEPTION 'fan-out completion is recorded once' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_point_cap_policy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_point_cap_policy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.created_by_admin_id IS NOT NULL AND
       NEW.effective_month <= date_trunc('month',
           NEW.created_at AT TIME ZONE 'Asia/Seoul')::date THEN
        RAISE EXCEPTION 'new cap policy must start next month or later'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_point_recovery_claim_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_point_recovery_claim_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    expected_source_type varchar(32);
    expected_source_id uuid;
BEGIN
    IF NEW.streak_milestone_award_id IS NOT NULL THEN
        expected_source_type := 'streak';
        expected_source_id := NEW.streak_milestone_award_id;
    ELSIF NEW.user_achievement_id IS NOT NULL THEN
        expected_source_type := 'achievement';
        expected_source_id := NEW.user_achievement_id;
    ELSE
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM point_transactions pt
         WHERE pt.id = NEW.original_award_transaction_id
           AND pt.user_id = NEW.user_id
           AND pt.source_type = expected_source_type
           AND pt.source_id = expected_source_id
           AND pt.kind = 'auto_award'
    ) THEN
        RAISE EXCEPTION 'recovery claim must reference its original point award'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_point_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_point_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    wallet_available bigint;
    wallet_outstanding bigint;
    claim_user_id uuid;
BEGIN
    -- 지갑 행 잠금으로 사용자별 거래를 직렬화, 스냅샷은 잠근 뒤 값과 일치해야 함
    SELECT available_points, outstanding_recovery_points
      INTO wallet_available, wallet_outstanding
      FROM point_wallets WHERE user_id = NEW.user_id FOR UPDATE;
    IF wallet_available IS NULL OR
       wallet_available <> NEW.balance_after OR
       wallet_outstanding <> NEW.outstanding_after THEN
        RAISE EXCEPTION 'point transaction snapshot must match locked wallet'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.recovery_claim_id IS NOT NULL THEN
        SELECT user_id INTO claim_user_id FROM point_recovery_claims
         WHERE id = NEW.recovery_claim_id;
        IF claim_user_id IS DISTINCT FROM NEW.user_id THEN
            RAISE EXCEPTION 'recovery claim belongs to another user'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_representative_badge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_representative_badge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.representative_achievement_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM user_achievements
         WHERE id = NEW.representative_achievement_id
           AND user_id = NEW.user_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'representative badge must be an active owned achievement'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_shop_order_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_shop_order_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    item_active boolean;
    price integer;
    price_effective_at timestamptz;
    tx_kind varchar(32);
    tx_source_type varchar(32);
    tx_source_id uuid;
    tx_delta bigint;
    tx_cap_delta bigint;
BEGIN
    SELECT is_active INTO item_active FROM shop_items WHERE id = NEW.item_id;
    SELECT price_points, effective_at INTO price, price_effective_at
      FROM shop_item_price_versions
     WHERE id = NEW.price_version_id AND item_id = NEW.item_id;
    IF item_active IS DISTINCT FROM true OR
       price IS DISTINCT FROM NEW.unit_points OR
       price_effective_at > NEW.created_at THEN
        RAISE EXCEPTION 'order needs an active item and its effective price'
            USING ERRCODE = '23514';
    END IF;

    -- total_points는 생성 열이라 BEFORE 트리거에서 NULL, 단가 × 수량을 직접 계산
    SELECT kind, source_type, source_id, available_delta, cap_delta
      INTO tx_kind, tx_source_type, tx_source_id, tx_delta, tx_cap_delta
      FROM point_transactions
     WHERE id = NEW.spend_transaction_id AND user_id = NEW.user_id;
    IF tx_kind IS DISTINCT FROM 'spend' OR
       tx_source_type IS DISTINCT FROM 'shop_order' OR
       tx_source_id IS DISTINCT FROM NEW.id OR
       tx_delta IS DISTINCT FROM -(NEW.unit_points::bigint * NEW.quantity) OR
       tx_cap_delta <> 0 THEN
        RAISE EXCEPTION 'order must match its point spend transaction'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'new order must be completed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_shop_order_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_shop_order_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    tx_kind varchar(32);
    tx_source_type varchar(32);
    tx_source_id uuid;
    tx_original uuid;
    tx_delta bigint;
    tx_cap_delta bigint;
BEGIN
    IF ROW(OLD.user_id, OLD.item_id, OLD.price_version_id, OLD.quantity,
           OLD.unit_points, OLD.spend_transaction_id, OLD.idempotency_key,
           OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.item_id, NEW.price_version_id, NEW.quantity,
           NEW.unit_points, NEW.spend_transaction_id, NEW.idempotency_key,
           NEW.created_at) THEN
        RAISE EXCEPTION 'order identity and amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'cancelled' AND
       ROW(OLD.status, OLD.refund_transaction_id, OLD.cancelled_at, OLD.cancel_reason)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.refund_transaction_id, NEW.cancelled_at, NEW.cancel_reason) THEN
        RAISE EXCEPTION 'cancelled order cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status = 'cancelled' THEN
        SELECT kind, source_type, source_id, original_transaction_id,
               available_delta, cap_delta
          INTO tx_kind, tx_source_type, tx_source_id, tx_original,
               tx_delta, tx_cap_delta
          FROM point_transactions
         WHERE id = NEW.refund_transaction_id AND user_id = NEW.user_id;
        IF tx_kind IS DISTINCT FROM 'refund' OR
           tx_source_type IS DISTINCT FROM 'shop_order' OR
           tx_source_id IS DISTINCT FROM NEW.id OR
           tx_original IS DISTINCT FROM NEW.spend_transaction_id OR
           tx_delta < 0 OR tx_delta > (NEW.unit_points::bigint * NEW.quantity) OR
           tx_cap_delta <> 0 THEN
            RAISE EXCEPTION 'refund must match the order and not count toward the cap'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_streak_milestone_award(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_streak_milestone_award() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    policy_points integer;
    policy_effective_at timestamptz;
    day_status varchar(12);
    last_failed_date date;
    successful_days integer;
    pending_days integer;
BEGIN
    SELECT points, effective_at
      INTO policy_points, policy_effective_at
      FROM streak_milestone_policy_versions
     WHERE id = NEW.policy_version_id
       AND target_success_days = NEW.target_success_days;

    SELECT status INTO day_status FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date = NEW.first_achieved_date;

    SELECT max(streak_date) INTO last_failed_date
      FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date <= NEW.first_achieved_date
       AND status = 'failed';

    SELECT count(*) FILTER (WHERE status = 'success'),
           count(*) FILTER (WHERE status = 'pending')
      INTO successful_days, pending_days
      FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date > COALESCE(last_failed_date, '-infinity'::date)
       AND streak_date <= NEW.first_achieved_date;

    IF policy_points IS DISTINCT FROM NEW.awarded_points
       OR policy_effective_at IS NULL
       OR (policy_effective_at AT TIME ZONE 'Asia/Seoul')::date
            > NEW.first_achieved_date
       OR day_status IS DISTINCT FROM 'success'
       OR successful_days <> NEW.target_success_days
       OR pending_days <> 0 THEN
        RAISE EXCEPTION 'milestone award requires its first confirmed threshold day'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_streak_point_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_streak_point_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.source_type = 'streak' AND NOT EXISTS (
        SELECT 1 FROM streak_milestone_awards
         WHERE id = NEW.source_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'streak point source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_support_resolution(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_support_resolution() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    ticket_status varchar(12);
    ticket_target uuid;
    action_user uuid;
BEGIN
    SELECT status, target_user_id INTO ticket_status, ticket_target
      FROM support_tickets WHERE id = NEW.ticket_id;
    IF ticket_status IS DISTINCT FROM 'in_review' THEN
        RAISE EXCEPTION 'resolution requires a ticket in review'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.outcome IN ('account_action', 'both') AND NEW.account_action_id IS NULL THEN
        RAISE EXCEPTION 'this outcome needs an account action'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.account_action_id IS NOT NULL AND ticket_target IS NOT NULL THEN
        SELECT user_id INTO action_user FROM account_actions
         WHERE id = NEW.account_action_id;
        IF action_user IS DISTINCT FROM ticket_target THEN
            RAISE EXCEPTION 'account action must target the reported member'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_support_resolution_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_support_resolution_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF to_jsonb(OLD) - 'account_action_id' = to_jsonb(NEW) - 'account_action_id'
       AND OLD.account_action_id IS NOT NULL AND NEW.account_action_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM account_actions WHERE id = OLD.account_action_id) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'support history is append-only' USING ERRCODE = '23514';
END;
$$;


--
-- Name: guard_support_ticket_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_support_ticket_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    resolution_exists boolean;
BEGIN
    IF ROW(OLD.ticket_type, OLD.category, OLD.subject, OLD.body, OLD.received_at,
           OLD.target_kind)
       IS DISTINCT FROM
       ROW(NEW.ticket_type, NEW.category, NEW.subject, NEW.body, NEW.received_at,
           NEW.target_kind) THEN
        RAISE EXCEPTION 'ticket content is immutable after receipt'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'received' AND NEW.status = 'in_review') OR
        (OLD.status = 'in_review' AND NEW.status = 'completed')) THEN
        RAISE EXCEPTION 'ticket status can only move forward'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND
       ROW(OLD.assigned_admin_id, OLD.completed_at)
       IS DISTINCT FROM ROW(NEW.assigned_admin_id, NEW.completed_at) THEN
        RAISE EXCEPTION 'completed ticket cannot change' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        SELECT EXISTS (SELECT 1 FROM support_ticket_resolutions
                        WHERE ticket_id = NEW.id) INTO resolution_exists;
        IF NOT resolution_exists THEN
            RAISE EXCEPTION 'a resolution is required before completing a ticket'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_achievement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_achievement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    definition_status varchar(16);
    version_condition varchar(40);
    version_target integer;
    version_category uuid;
    version_points integer;
    version_image_id uuid;
    version_effective_at timestamptz;
    current_version_id uuid;
    source_goal_status varchar(20);
    source_mission_status varchar(20);
    source_mission_category uuid;
    source_streak_target integer;
    source_streak_status varchar(12);
    qualifying_count integer;
BEGIN
    SELECT status INTO definition_status
      FROM achievement_definitions WHERE id = NEW.achievement_id;
    SELECT condition_type, target_count, category_id, reward_points,
           badge_image_id, effective_at
      INTO version_condition, version_target, version_category,
           version_points, version_image_id, version_effective_at
      FROM achievement_versions
     WHERE id = NEW.achievement_version_id
       AND achievement_id = NEW.achievement_id;

    SELECT id INTO current_version_id
      FROM achievement_versions
     WHERE achievement_id = NEW.achievement_id
       AND effective_at <= NEW.awarded_at
     ORDER BY effective_at DESC, version_no DESC
     LIMIT 1;

    IF definition_status IS DISTINCT FROM 'public'
       OR current_version_id IS DISTINCT FROM NEW.achievement_version_id
       OR version_points IS DISTINCT FROM NEW.awarded_points
       OR version_image_id IS DISTINCT FROM NEW.badge_image_id
       OR version_effective_at > NEW.awarded_at
       OR NEW.status <> 'active' THEN
        RAISE EXCEPTION 'achievement grant requires current public definition and version'
            USING ERRCODE = '23514';
    END IF;

    IF version_condition = 'first_goal_completed' THEN
        IF NEW.source_type <> 'goal' THEN
            RAISE EXCEPTION 'first goal achievement requires a goal source'
                USING ERRCODE = '23514';
        END IF;
        SELECT status INTO source_goal_status FROM goals
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_goal_status IS DISTINCT FROM 'completed' THEN
            RAISE EXCEPTION 'goal source is not completed'
                USING ERRCODE = '23514';
        END IF;
    ELSIF version_condition IN
        ('approved_mission_count', 'category_approved_mission_count') THEN
        IF NEW.source_type <> 'mission' THEN
            RAISE EXCEPTION 'mission count achievement requires mission source'
                USING ERRCODE = '23514';
        END IF;
        SELECT status, category_id
          INTO source_mission_status, source_mission_category
          FROM missions
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_mission_status IS DISTINCT FROM 'completed'
           OR (version_condition = 'category_approved_mission_count'
               AND source_mission_category IS DISTINCT FROM version_category)
           OR NOT EXISTS (
               SELECT 1 FROM mission_records mr
               JOIN verification_results vr ON vr.record_id = mr.id
               WHERE mr.mission_id = NEW.source_id
                 AND vr.decision = 'approved' AND vr.is_current
           )
        THEN
            RAISE EXCEPTION 'mission source is not an approved completed mission'
                USING ERRCODE = '23514';
        END IF;
        SELECT count(DISTINCT m.id) INTO qualifying_count
          FROM missions m
         WHERE m.user_id = NEW.user_id
           AND m.status = 'completed'
           AND (version_category IS NULL OR m.category_id = version_category)
           AND EXISTS (
               SELECT 1 FROM mission_records mr
               JOIN verification_results vr ON vr.record_id = mr.id
               WHERE mr.mission_id = m.id
                 AND vr.decision = 'approved' AND vr.is_current
           );
        IF qualifying_count < version_target THEN
            RAISE EXCEPTION 'approved mission count is below achievement target'
                USING ERRCODE = '23514';
        END IF;
    ELSIF version_condition = 'streak_milestone' THEN
        IF NEW.source_type <> 'streak' THEN
            RAISE EXCEPTION 'streak achievement requires milestone source'
                USING ERRCODE = '23514';
        END IF;
        SELECT target_success_days, status
          INTO source_streak_target, source_streak_status
          FROM streak_milestone_awards
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_streak_target IS DISTINCT FROM version_target
           OR source_streak_status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'streak milestone does not match achievement'
                USING ERRCODE = '23514';
        END IF;
    ELSIF version_condition = 'challenge_completed' THEN
        IF NEW.source_type <> 'challenge' OR NOT EXISTS (
            SELECT 1 FROM challenge_reward_grants crg
            JOIN challenge_reward_packages crp ON crp.challenge_id=crg.challenge_id
            WHERE crg.id=NEW.source_id AND crg.user_id=NEW.user_id
              AND crg.status='active'
              AND crp.badge_achievement_version_id=NEW.achievement_version_id
        ) THEN
            RAISE EXCEPTION 'challenge badge requires active matching reward grant'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        RAISE EXCEPTION 'unsupported achievement condition'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_achievement_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_achievement_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    grant_status varchar(12);
    source_owned boolean;
BEGIN
    SELECT status INTO grant_status FROM user_achievements
     WHERE id = NEW.user_achievement_id AND user_id = NEW.user_id;
    IF (NEW.event_type = 'revoked' AND grant_status IS DISTINCT FROM 'revoked')
       OR (NEW.event_type <> 'revoked' AND grant_status IS DISTINCT FROM 'active')
    THEN
        RAISE EXCEPTION 'achievement event does not match grant status'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.source_type = 'goal' THEN
        SELECT EXISTS (SELECT 1 FROM goals
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSIF NEW.source_type = 'mission' THEN
        SELECT EXISTS (SELECT 1 FROM missions
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSIF NEW.source_type = 'streak' THEN
        SELECT EXISTS (SELECT 1 FROM streak_milestone_awards
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSE
        SELECT EXISTS (SELECT 1 FROM challenge_reward_grants
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    END IF;
    IF NOT source_owned THEN
        RAISE EXCEPTION 'achievement event source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_achievement_paid_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_achievement_paid_points() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.paid_points IS DISTINCT FROM OLD.paid_points AND (
        OLD.status <> 'active'
        OR EXISTS (SELECT 1 FROM point_recovery_claims c
                    WHERE c.user_achievement_id = OLD.id)
    ) THEN
        RAISE EXCEPTION 'achievement paid points are fixed after revoke or recovery claim'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_experience(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_experience() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE calculated integer;
BEGIN
    IF TG_OP='UPDATE' AND OLD.level_policy_version_id IS DISTINCT FROM NEW.level_policy_version_id THEN
        RAISE EXCEPTION 'user level policy cannot change' USING ERRCODE='23514';
    END IF;
    SELECT max(level_no) INTO calculated FROM user_level_thresholds
     WHERE policy_version_id=NEW.level_policy_version_id AND min_total_xp<=NEW.total_xp;
    IF calculated IS NULL OR calculated<>NEW.level_no THEN
        RAISE EXCEPTION 'user level does not match XP policy' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_user_idempotency_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_idempotency_key() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.user_id, OLD.idempotency_key, OLD.operation,
           OLD.request_hash, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.idempotency_key, NEW.operation,
           NEW.request_hash, NEW.created_at) THEN
        RAISE EXCEPTION 'idempotency request identity is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'completed idempotency key cannot reopen'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_notification_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_notification_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    notice_row notices%ROWTYPE;
BEGIN
    IF NEW.kind <> 'notice' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO notice_row FROM notices WHERE id = NEW.notice_id;
    IF notice_row.status IS DISTINCT FROM 'published' THEN
        RAISE EXCEPTION 'notification needs a published notice' USING ERRCODE = '23514';
    END IF;
    IF notice_row.audience_type = 'users' AND NOT EXISTS (
        SELECT 1 FROM notice_recipients
         WHERE notice_id = NEW.notice_id AND user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'member is not a recipient of this notice'
            USING ERRCODE = '23514';
    END IF;
    IF NOT notice_row.send_push AND NEW.push_status <> 'none' THEN
        RAISE EXCEPTION 'notice without push cannot carry a push status'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.title <> notice_row.title OR NEW.body <> notice_row.body THEN
        RAISE EXCEPTION 'notification must copy the published notice'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_notification_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_notification_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.user_id, OLD.kind, OLD.notice_id, OLD.event_key, OLD.title,
           OLD.body, OLD.link_screen, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.kind, NEW.notice_id, NEW.event_key, NEW.title,
           NEW.body, NEW.link_screen, NEW.created_at) THEN
        RAISE EXCEPTION 'notification content is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
        RAISE EXCEPTION 'read time is recorded once' USING ERRCODE = '23514';
    END IF;
    IF OLD.push_status IN ('sent', 'skipped', 'none') AND
       NEW.push_status IS DISTINCT FROM OLD.push_status THEN
        RAISE EXCEPTION 'push result is final' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_user_pet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_user_pet() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE calculated integer; spec_effective timestamptz; level_effective timestamptz;
        unlock_type text; unlock_target integer; unlock_category uuid; unlock_achievement uuid;
        actual_count integer; baby_xp bigint; adult_xp bigint; hatch_required integer;
        expected_stage smallint;
BEGIN
    IF TG_OP='INSERT' THEN
        SELECT effective_at, unlock_condition_type, unlock_target_count,
               unlock_category_id, unlock_achievement_id
          INTO spec_effective, unlock_type, unlock_target, unlock_category, unlock_achievement
          FROM pet_species_versions WHERE id=NEW.species_version_id;
        SELECT effective_at INTO level_effective FROM pet_level_policy_versions WHERE id=NEW.level_policy_version_id;
        IF spec_effective>NEW.selected_at OR level_effective>NEW.selected_at OR
           NOT EXISTS(SELECT 1 FROM pet_species WHERE id=NEW.species_id AND status='public') OR
           (SELECT count(*) FROM pet_stage_versions WHERE species_version_id=NEW.species_version_id)<>3 THEN
            RAISE EXCEPTION 'pet policies must be published and complete at selection' USING ERRCODE='23514';
        END IF;
        IF unlock_type='approved_mission_count' OR unlock_type='category_approved_mission_count' THEN
            SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
            JOIN mission_records mr ON mr.mission_id=m.id
            JOIN verification_results vr ON vr.record_id=mr.id
            WHERE m.user_id=NEW.user_id AND m.status='completed'
              AND vr.decision='approved' AND vr.is_current
              AND (unlock_type='approved_mission_count' OR m.category_id=unlock_category);
            IF actual_count<unlock_target THEN RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        ELSIF unlock_type='streak_milestone' THEN
            IF NOT EXISTS (SELECT 1 FROM streak_milestone_awards
                WHERE user_id=NEW.user_id AND target_success_days=unlock_target AND status='active') THEN
                RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        ELSIF unlock_type='achievement_earned' THEN
            IF NOT EXISTS (SELECT 1 FROM user_achievements
                WHERE user_id=NEW.user_id AND achievement_id=unlock_achievement AND status='active') THEN
                RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        END IF;
    ELSE
        IF ROW(OLD.user_id,OLD.species_id,OLD.species_version_id,OLD.level_policy_version_id,OLD.selected_at)
           IS DISTINCT FROM ROW(NEW.user_id,NEW.species_id,NEW.species_version_id,NEW.level_policy_version_id,NEW.selected_at) THEN
            RAISE EXCEPTION 'pet identity and policies cannot change' USING ERRCODE='23514';
        END IF;
    END IF;
    SELECT max(level_no) INTO calculated FROM pet_level_thresholds
     WHERE policy_version_id=NEW.level_policy_version_id AND min_total_xp<=NEW.total_xp;
    IF calculated IS NULL OR calculated<>NEW.level_no THEN
        RAISE EXCEPTION 'pet level does not match XP policy' USING ERRCODE='23514';
    END IF;
    SELECT min_total_xp INTO baby_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=2;
    SELECT min_total_xp INTO adult_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=3;
    SELECT hatch_mission_count INTO hatch_required FROM pet_species_versions
     WHERE id=NEW.species_version_id;
    SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
    JOIN mission_records mr ON mr.mission_id=m.id
    JOIN verification_results vr ON vr.record_id=mr.id
    JOIN pet_species_versions psv ON psv.id=NEW.species_version_id
    WHERE m.user_id=NEW.user_id AND m.category_id=psv.category_id
      AND m.status='completed' AND mr.started_at>=NEW.selected_at
      AND vr.decision='approved' AND vr.is_current;
    expected_stage:=CASE WHEN NEW.total_xp<baby_xp OR actual_count<hatch_required THEN 1
                         WHEN NEW.total_xp<adult_xp THEN 2 ELSE 3 END;
    IF NEW.stage_no<>expected_stage THEN
        RAISE EXCEPTION 'pet stage does not match XP and hatch conditions' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_verification_appeal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_verification_appeal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    original_decision varchar(20);
    original_notified_at timestamptz;
    resolution_source varchar(20);
    resolution_decision varchar(20);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT decision, notified_at
          INTO original_decision, original_notified_at
          FROM verification_results
         WHERE id = NEW.original_result_id AND record_id = NEW.record_id;

        IF original_decision IS DISTINCT FROM 'rejected'
           OR original_notified_at IS NULL
           OR now() > original_notified_at + interval '7 days' THEN
            RAISE EXCEPTION 'appeal requires a rejected result notified within 7 days'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW.status <> 'open' THEN
        SELECT source, decision
          INTO resolution_source, resolution_decision
          FROM verification_results
         WHERE id = NEW.resolution_result_id AND record_id = NEW.record_id;

        IF resolution_source IS DISTINCT FROM 'admin'
           OR (NEW.status = 'accepted' AND
               resolution_decision IS DISTINCT FROM 'approved')
           OR (NEW.status = 'rejected' AND
               resolution_decision IS DISTINCT FROM 'rejected') THEN
            RAISE EXCEPTION 'appeal outcome requires matching administrator result'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: lock_mission_point_award_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_mission_point_award_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.mission_id, OLD.user_id, OLD.first_approved_result_id,
           OLD.original_points, OLD.paid_points, OLD.awarded_at)
       IS DISTINCT FROM
       ROW(NEW.mission_id, NEW.user_id, NEW.first_approved_result_id,
           NEW.original_points, NEW.paid_points, NEW.awarded_at) THEN
        RAISE EXCEPTION 'mission award identity and original amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: lock_mission_reward(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_mission_reward() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.reward_points, OLD.reward_rate_version_id)
       IS DISTINCT FROM ROW(NEW.reward_points, NEW.reward_rate_version_id) THEN
        RAISE EXCEPTION 'mission reward is fixed at creation'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: lock_mission_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_mission_xp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.reward_user_xp, OLD.reward_pet_xp)
       IS DISTINCT FROM ROW(NEW.reward_user_xp, NEW.reward_pet_xp) THEN
        RAISE EXCEPTION 'mission XP is fixed at creation' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: lock_started_mission_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_started_mission_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status <> 'scheduled' OR NEW.status <> 'scheduled' THEN
        IF ROW(OLD.user_id, OLD.goal_id, OLD.goal_step_id,
               OLD.source_proposal_id, OLD.source_type, OLD.title, OLD.description,
               OLD.category_id, OLD.difficulty_id, OLD.target_value,
               OLD.target_unit, OLD.estimated_duration_seconds,
               OLD.verification_method, OLD.scheduled_date, OLD.due_at,
               OLD.is_required, OLD.exercise_code)
           IS DISTINCT FROM
           ROW(NEW.user_id, NEW.goal_id, NEW.goal_step_id,
               NEW.source_proposal_id, NEW.source_type, NEW.title, NEW.description,
               NEW.category_id, NEW.difficulty_id, NEW.target_value,
               NEW.target_unit, NEW.estimated_duration_seconds,
               NEW.verification_method, NEW.scheduled_date, NEW.due_at,
               NEW.is_required, NEW.exercise_code) THEN
            RAISE EXCEPTION 'mission rules cannot change after execution starts';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: lock_streak_milestone_award_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_streak_milestone_award_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.id, OLD.user_id, OLD.target_success_days,
           OLD.policy_version_id, OLD.awarded_points, OLD.paid_points,
           OLD.first_achieved_date, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.id, NEW.user_id, NEW.target_success_days,
           NEW.policy_version_id, NEW.awarded_points, NEW.paid_points,
           NEW.first_achieved_date, NEW.created_at) THEN
        RAISE EXCEPTION 'streak award identity and original amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: lock_user_achievement_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_user_achievement_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.id, OLD.user_id, OLD.achievement_id,
           OLD.achievement_version_id, OLD.badge_image_id,
           OLD.source_type, OLD.source_id, OLD.first_achieved_at,
           OLD.awarded_at, OLD.awarded_points)
       IS DISTINCT FROM
       ROW(NEW.id, NEW.user_id, NEW.achievement_id,
           NEW.achievement_version_id, NEW.badge_image_id,
           NEW.source_type, NEW.source_id, NEW.first_achieved_at,
           NEW.awarded_at, NEW.awarded_points) THEN
        RAISE EXCEPTION 'achievement grant identity and original reward are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: protect_achievement_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_achievement_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'published achievement versions are immutable'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_badge_image(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_badge_image() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'confirmed badge image metadata is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: protect_experience_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_experience_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'experience ledger is append-only' USING ERRCODE='23514';
END $$;


--
-- Name: protect_inventory_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_inventory_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'inventory events are append-only' USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_mission_reward_rate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_mission_reward_rate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'published reward rates are immutable'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_point_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_point_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'point transactions are append-only'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_shop_price_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_shop_price_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'published shop prices are immutable' USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_streak_milestone_award_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_streak_milestone_award_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RAISE EXCEPTION 'streak award history cannot be deleted'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: protect_streak_milestone_policy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_streak_milestone_policy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'published streak milestone policies are immutable'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_support_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_support_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 티켓 삭제로 인한 연쇄 삭제는 통과 (부모가 이미 없음)
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM support_tickets WHERE id = OLD.ticket_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'support history is append-only' USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_user_achievement_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_user_achievement_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RAISE EXCEPTION 'earned achievement history cannot be deleted'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: protect_user_achievement_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_user_achievement_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'achievement events are append-only'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_user_pet_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_user_pet_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN
        RAISE EXCEPTION 'pet cannot be deleted before account withdrawal' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
END $$;


--
-- Name: protect_verification_criteria_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_verification_criteria_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'published verification criteria are immutable'
        USING ERRCODE = '23514';
END;
$$;


--
-- Name: protect_verification_result(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_verification_result() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(OLD.record_id, OLD.result_no, OLD.source, OLD.decision,
           OLD.criteria_version_id, OLD.engine_version, OLD.confidence,
           OLD.metrics, OLD.reason, OLD.reviewed_by_admin_id, OLD.decided_at,
           OLD.ingest_key, OLD.raw_result)
       IS DISTINCT FROM
       ROW(NEW.record_id, NEW.result_no, NEW.source, NEW.decision,
           NEW.criteria_version_id, NEW.engine_version, NEW.confidence,
           NEW.metrics, NEW.reason, NEW.reviewed_by_admin_id, NEW.decided_at,
           NEW.ingest_key, NEW.raw_result)
       OR (OLD.is_current = false AND NEW.is_current = true)
       OR (OLD.notified_at IS NOT NULL AND
           NEW.notified_at IS DISTINCT FROM OLD.notified_at) THEN
        RAISE EXCEPTION 'verification result history is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: protect_xp_policy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_xp_policy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'XP policy is immutable' USING ERRCODE='23514'; END $$;


--
-- Name: reject_challenge_streak_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_challenge_streak_day() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.qualifying_mission_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM missions WHERE id=NEW.qualifying_mission_id AND source_type='challenge') THEN
        RAISE EXCEPTION 'challenge daily missions do not count toward ordinary streak'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: require_r2_cleanup_before_user_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_r2_cleanup_before_user_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM media_files
         WHERE user_id = OLD.id AND upload_status <> 'deleted'
    ) THEN
        RAISE EXCEPTION 'R2 objects must be cleaned before deleting user'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: scrub_user_account_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.scrub_user_account_logs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE account_withdrawal_requests
       SET reason = NULL
     WHERE user_id = OLD.id;

    UPDATE admin_audit_logs
       SET reason = NULL,
           before_value = NULL,
           after_value = NULL
     WHERE target_user_id = OLD.id;

    RETURN OLD;
END;
$$;


--
-- Name: scrub_user_challenge_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.scrub_user_challenge_logs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE challenge_publication_reviews
       SET reason=CASE WHEN decision IN ('rejected','hidden')
                       THEN '탈퇴 회원 관련 기록' ELSE NULL END
     WHERE requested_by_user_id=OLD.id;
    UPDATE challenge_rule_events SET reason='탈퇴 회원 관련 기록'
     WHERE requested_by_user_id=OLD.id;
    RETURN OLD;
END $$;


--
-- Name: scrub_user_mission_reviews(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.scrub_user_mission_reviews() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE mission_publication_reviews
       SET reason = NULL
     WHERE requested_by_user_id = OLD.id;
    RETURN OLD;
END;
$$;


--
-- Name: snapshot_mission_pet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_mission_pet() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE selected_pet uuid; selected_stage smallint; selected_bonus integer;
        pet_category uuid; mission_category uuid;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.reward_pet_id,OLD.reward_pet_stage_no,OLD.reward_pet_bonus_basis_points)
           IS DISTINCT FROM ROW(NEW.reward_pet_id,NEW.reward_pet_stage_no,NEW.reward_pet_bonus_basis_points) THEN
            RAISE EXCEPTION 'mission pet reward snapshot is immutable' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    NEW.reward_pet_id:=NULL;
    NEW.reward_pet_stage_no:=NULL;
    NEW.reward_pet_bonus_basis_points:=0;
    SELECT p.representative_pet_id, up.stage_no, psv.category_id, m.category_id
      INTO selected_pet, selected_stage, pet_category, mission_category
      FROM profiles p JOIN missions m ON m.user_id=p.user_id
      LEFT JOIN user_pets up ON up.id=p.representative_pet_id
      LEFT JOIN pet_species_versions psv ON psv.id=up.species_version_id
     WHERE m.id=NEW.mission_id AND p.user_id=NEW.user_id;
    IF selected_pet IS NOT NULL THEN
        SELECT bonus_basis_points INTO selected_bonus FROM pet_stage_versions
         WHERE species_version_id=(SELECT species_version_id FROM user_pets WHERE id=selected_pet)
           AND stage_no=selected_stage;
        NEW.reward_pet_id:=selected_pet;
        NEW.reward_pet_stage_no:=selected_stage;
        NEW.reward_pet_bonus_basis_points:=CASE WHEN pet_category=mission_category THEN selected_bonus ELSE 0 END;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: validate_mission_reward(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_reward() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    definition_origin varchar(20);
    definition_points integer;
    rate_points integer;
    rate_effective_at timestamptz;
BEGIN
    IF NEW.source_type = 'template' THEN
        SELECT origin, base_points
          INTO definition_origin, definition_points
          FROM mission_definitions WHERE id = NEW.definition_id;
        IF definition_origin = 'admin' THEN
            IF definition_points IS DISTINCT FROM NEW.reward_points OR
               NEW.reward_rate_version_id IS NOT NULL THEN
                RAISE EXCEPTION 'template reward must match administrator definition'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.reward_rate_version_id IS NOT NULL THEN
        SELECT points, effective_at INTO rate_points, rate_effective_at
          FROM mission_reward_rate_versions
         WHERE id = NEW.reward_rate_version_id;
        IF rate_points IS DISTINCT FROM NEW.reward_points OR
           rate_effective_at > NEW.created_at THEN
            RAISE EXCEPTION 'mission reward must match effective rate version'
                USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.reward_points <> 0 THEN
        RAISE EXCEPTION 'positive mission reward requires a rate version'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validate_mission_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    definition_owner uuid;
    definition_status varchar(24);
    proposal_status varchar(20);
BEGIN
    IF NEW.definition_id IS NOT NULL THEN
        SELECT created_by_user_id, publication_status
          INTO definition_owner, definition_status
          FROM mission_definitions
         WHERE id = NEW.definition_id;

        IF definition_status IS NULL
           OR definition_status = 'hidden'
           OR (definition_status <> 'public'
               AND definition_owner IS DISTINCT FROM NEW.user_id) THEN
            RAISE EXCEPTION 'mission definition is not available to this user'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.source_proposal_id IS NOT NULL THEN
        SELECT status INTO proposal_status
          FROM ai_plan_proposals
         WHERE id = NEW.source_proposal_id AND user_id = NEW.user_id;

        IF proposal_status IS DISTINCT FROM 'accepted' THEN
            RAISE EXCEPTION 'AI proposal must be accepted before creating missions'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validate_mission_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_xp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE def_origin text; def_user_xp integer; def_pet_xp integer;
        rate_user_xp integer; rate_pet_xp integer;
BEGIN
    IF NEW.source_type = 'template' THEN
        SELECT origin, base_user_xp, base_pet_xp
          INTO def_origin, def_user_xp, def_pet_xp
          FROM mission_definitions WHERE id = NEW.definition_id;
        IF def_origin = 'admin' THEN
            IF ROW(NEW.reward_user_xp, NEW.reward_pet_xp)
               IS DISTINCT FROM ROW(def_user_xp, def_pet_xp) THEN
                RAISE EXCEPTION 'template XP must match definition' USING ERRCODE='23514';
            END IF;
            RETURN NEW;
        END IF;
    END IF;
    IF NEW.reward_rate_version_id IS NOT NULL THEN
        SELECT user_xp, pet_xp INTO rate_user_xp, rate_pet_xp
          FROM mission_reward_rate_versions WHERE id=NEW.reward_rate_version_id;
        IF ROW(NEW.reward_user_xp, NEW.reward_pet_xp)
           IS DISTINCT FROM ROW(rate_user_xp, rate_pet_xp) THEN
            RAISE EXCEPTION 'mission XP must match reward rate' USING ERRCODE='23514';
        END IF;
    ELSIF NEW.reward_user_xp <> 0 OR NEW.reward_pet_xp <> 0 THEN
        RAISE EXCEPTION 'positive mission XP requires reward rate' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;


--
-- Name: validate_streak_success(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_streak_success() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    mission_date date;
    mission_status varchar(20);
    submitted_at timestamptz;
    result_decision varchar(20);
    result_is_current boolean;
BEGIN
    IF NEW.status <> 'success' THEN
        RETURN NEW;
    END IF;

    SELECT m.scheduled_date, m.status, mr.submitted_at,
           vr.decision, vr.is_current
      INTO mission_date, mission_status, submitted_at,
           result_decision, result_is_current
      FROM missions m
      JOIN mission_records mr ON mr.mission_id = m.id
      JOIN verification_results vr ON vr.record_id = mr.id
     WHERE m.id = NEW.qualifying_mission_id
       AND m.user_id = NEW.user_id
       AND mr.id = NEW.qualifying_record_id
       AND vr.id = NEW.qualifying_result_id;

    IF mission_date IS DISTINCT FROM NEW.streak_date
       OR mission_status IS DISTINCT FROM 'completed'
       OR submitted_at IS NULL
       OR (submitted_at AT TIME ZONE 'Asia/Seoul')::date
            IS DISTINCT FROM NEW.streak_date
       OR result_decision IS DISTINCT FROM 'approved'
       OR result_is_current IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'streak success requires a same-day submitted approved mission'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validate_verification_result_criteria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_verification_result_criteria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    mission_category_id uuid;
    mission_method varchar(30);
    criteria_category_id uuid;
    criteria_method varchar(30);
    criteria_effective_at timestamptz;
BEGIN
    SELECT m.category_id, m.verification_method
      INTO mission_category_id, mission_method
      FROM mission_records mr
      JOIN missions m ON m.id = mr.mission_id
     WHERE mr.id = NEW.record_id;

    SELECT category_id, verification_method, effective_at
      INTO criteria_category_id, criteria_method, criteria_effective_at
      FROM verification_criteria_versions
     WHERE id = NEW.criteria_version_id;

    IF mission_category_id IS DISTINCT FROM criteria_category_id
       OR mission_method IS DISTINCT FROM criteria_method
       OR criteria_effective_at > NEW.decided_at THEN
        RAISE EXCEPTION 'criteria version does not apply to this mission'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_actions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    action_type character varying(20) NOT NULL,
    reason text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    lifted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_ticket_id uuid,
    CONSTRAINT account_actions_action_type_check CHECK (((action_type)::text = ANY (ARRAY[('warning'::character varying)::text, ('restriction'::character varying)::text]))),
    CONSTRAINT account_actions_check CHECK (((((action_type)::text = 'warning'::text) AND (ends_at IS NULL)) OR (((action_type)::text = 'restriction'::text) AND (ends_at IS NOT NULL) AND (ends_at > starts_at)))),
    CONSTRAINT account_actions_check1 CHECK (((lifted_at IS NULL) OR (lifted_at >= starts_at))),
    CONSTRAINT account_actions_reason_check CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: account_withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_withdrawal_requests (
    id uuid NOT NULL,
    user_id uuid,
    status character varying(24) DEFAULT 'requested'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reason text,
    completed_at timestamp with time zone,
    CONSTRAINT account_withdrawal_requests_check CHECK (((user_id IS NOT NULL) OR ((status)::text = 'completed'::text))),
    CONSTRAINT account_withdrawal_requests_check1 CHECK (((completed_at IS NULL) OR ((status)::text = 'completed'::text))),
    CONSTRAINT account_withdrawal_requests_check2 CHECK ((((status)::text <> 'completed'::text) OR (completed_at IS NOT NULL))),
    CONSTRAINT account_withdrawal_requests_check3 CHECK (((reviewed_at IS NULL) OR (reviewed_by IS NOT NULL))),
    CONSTRAINT account_withdrawal_requests_status_check CHECK (((status)::text = ANY (ARRAY[('requested'::character varying)::text, ('cancelled'::character varying)::text, ('on_hold'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text])))
);


--
-- Name: achievement_backfill_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_backfill_runs (
    id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    version_id uuid NOT NULL,
    requested_by_admin_id uuid NOT NULL,
    cursor_user_id uuid,
    processed_users integer DEFAULT 0 NOT NULL,
    earned_count integer DEFAULT 0 NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT achievement_backfill_runs_check CHECK (((completed_at IS NULL) OR (completed_at >= requested_at))),
    CONSTRAINT achievement_backfill_runs_earned_count_check CHECK ((earned_count >= 0)),
    CONSTRAINT achievement_backfill_runs_processed_users_check CHECK ((processed_users >= 0))
);


--
-- Name: achievement_badge_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_badge_images (
    id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    version_no integer NOT NULL,
    r2_object_key text NOT NULL,
    mime_type character varying(40) NOT NULL,
    size_bytes bigint NOT NULL,
    uploaded_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT achievement_badge_images_mime_type_check CHECK (((mime_type)::text = ANY (ARRAY[('image/png'::character varying)::text, ('image/jpeg'::character varying)::text, ('image/webp'::character varying)::text]))),
    CONSTRAINT achievement_badge_images_r2_object_key_check CHECK ((length(btrim(r2_object_key)) > 0)),
    CONSTRAINT achievement_badge_images_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT achievement_badge_images_version_no_check CHECK ((version_no > 0))
);


--
-- Name: achievement_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_definitions (
    id uuid NOT NULL,
    code character varying(80) NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT achievement_definitions_code_check CHECK (((code)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT achievement_definitions_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('public'::character varying)::text, ('hidden'::character varying)::text])))
);


--
-- Name: achievement_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_versions (
    id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    version_no integer NOT NULL,
    title character varying(160) NOT NULL,
    description text NOT NULL,
    rarity character varying(16) NOT NULL,
    condition_type character varying(40) NOT NULL,
    target_count integer NOT NULL,
    category_id uuid,
    reward_points integer NOT NULL,
    badge_image_id uuid NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reward_user_xp integer DEFAULT 0 NOT NULL,
    reward_pet_xp integer DEFAULT 0 NOT NULL,
    CONSTRAINT achievement_versions_check CHECK (((((condition_type)::text = 'first_goal_completed'::text) AND (target_count = 1) AND (category_id IS NULL)) OR (((condition_type)::text = 'approved_mission_count'::text) AND (category_id IS NULL)) OR (((condition_type)::text = 'category_approved_mission_count'::text) AND (category_id IS NOT NULL)) OR (((condition_type)::text = 'streak_milestone'::text) AND (target_count = ANY (ARRAY[7, 30, 100])) AND (category_id IS NULL) AND (reward_points = 0)) OR (((condition_type)::text = 'challenge_completed'::text) AND (target_count = 1) AND (category_id IS NULL) AND (reward_points = 0) AND (reward_user_xp = 0) AND (reward_pet_xp = 0)))),
    CONSTRAINT achievement_versions_condition_type_check CHECK (((condition_type)::text = ANY (ARRAY[('first_goal_completed'::character varying)::text, ('approved_mission_count'::character varying)::text, ('category_approved_mission_count'::character varying)::text, ('streak_milestone'::character varying)::text, ('challenge_completed'::character varying)::text]))),
    CONSTRAINT achievement_versions_description_check CHECK ((length(btrim(description)) > 0)),
    CONSTRAINT achievement_versions_rarity_check CHECK (((rarity)::text = ANY (ARRAY[('common'::character varying)::text, ('rare'::character varying)::text, ('legendary'::character varying)::text]))),
    CONSTRAINT achievement_versions_reward_pet_xp_check CHECK ((reward_pet_xp >= 0)),
    CONSTRAINT achievement_versions_reward_points_check CHECK ((reward_points >= 0)),
    CONSTRAINT achievement_versions_reward_user_xp_check CHECK ((reward_user_xp >= 0)),
    CONSTRAINT achievement_versions_target_count_check CHECK ((target_count > 0)),
    CONSTRAINT achievement_versions_title_check CHECK ((length(btrim((title)::text)) > 0)),
    CONSTRAINT achievement_versions_version_no_check CHECK ((version_no > 0)),
    CONSTRAINT streak_achievement_xp_zero CHECK ((((condition_type)::text <> 'streak_milestone'::text) OR ((reward_user_xp = 0) AND (reward_pet_xp = 0))))
);


--
-- Name: admin_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_accounts (
    id uuid NOT NULL,
    login_id character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    failed_attempt_count smallint DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_accounts_email_check CHECK ((((email)::text = lower(btrim((email)::text))) AND (POSITION(('@'::text) IN (email)) > 1))),
    CONSTRAINT admin_accounts_failed_attempt_count_check CHECK (((failed_attempt_count >= 0) AND (failed_attempt_count <= 5))),
    CONSTRAINT admin_accounts_login_id_check CHECK (((login_id)::text ~ '^[A-Za-z0-9_]{3,50}$'::text)),
    CONSTRAINT admin_accounts_password_hash_check CHECK ((length(password_hash) > 0)),
    CONSTRAINT admin_accounts_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text])))
);


--
-- Name: admin_asset_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_asset_uploads (
    id uuid NOT NULL,
    asset_kind character varying(12) NOT NULL,
    owner_id uuid NOT NULL,
    version_no integer,
    object_key text NOT NULL,
    mime_type character varying(40) NOT NULL,
    size_bytes bigint NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_at timestamp with time zone,
    consumed_at timestamp with time zone,
    CONSTRAINT admin_asset_uploads_asset_kind_check CHECK (((asset_kind)::text = ANY (ARRAY[('badge'::character varying)::text, ('pet_stage'::character varying)::text]))),
    CONSTRAINT admin_asset_uploads_check CHECK ((((asset_kind)::text = 'badge'::text) = (version_no IS NOT NULL))),
    CONSTRAINT admin_asset_uploads_check1 CHECK (((consumed_at IS NULL) OR (uploaded_at IS NOT NULL))),
    CONSTRAINT admin_asset_uploads_mime_type_check CHECK (((mime_type)::text = ANY (ARRAY[('image/png'::character varying)::text, ('image/jpeg'::character varying)::text, ('image/webp'::character varying)::text]))),
    CONSTRAINT admin_asset_uploads_object_key_check CHECK ((length(btrim(object_key)) > 0)),
    CONSTRAINT admin_asset_uploads_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT admin_asset_uploads_version_no_check CHECK ((version_no > 0))
);


--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id uuid NOT NULL,
    admin_id uuid NOT NULL,
    target_user_id uuid,
    action character varying(80) NOT NULL,
    result character varying(20) NOT NULL,
    reason text,
    before_value jsonb,
    after_value jsonb,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_audit_logs_result_check CHECK (((result)::text = ANY (ARRAY[('success'::character varying)::text, ('failure'::character varying)::text])))
);


--
-- Name: admin_idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_idempotency_keys (
    id uuid NOT NULL,
    admin_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    operation character varying(80) NOT NULL,
    request_hash text NOT NULL,
    status character varying(12) DEFAULT 'in_progress'::character varying NOT NULL,
    response_status smallint,
    response_body jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT admin_idempotency_keys_check CHECK (((((status)::text = 'in_progress'::text) AND (completed_at IS NULL) AND (response_status IS NULL)) OR (((status)::text <> 'in_progress'::text) AND (completed_at IS NOT NULL) AND (completed_at >= created_at)))),
    CONSTRAINT admin_idempotency_keys_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT admin_idempotency_keys_operation_check CHECK ((length(btrim((operation)::text)) > 0)),
    CONSTRAINT admin_idempotency_keys_request_hash_check CHECK ((length(request_hash) > 0)),
    CONSTRAINT admin_idempotency_keys_response_status_check CHECK (((response_status >= 100) AND (response_status <= 599))),
    CONSTRAINT admin_idempotency_keys_status_check CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: admin_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_sessions (
    id uuid NOT NULL,
    admin_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT admin_sessions_check CHECK ((expires_at > created_at)),
    CONSTRAINT admin_sessions_check1 CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT admin_sessions_refresh_token_hash_check CHECK ((length(refresh_token_hash) > 0))
);


--
-- Name: ai_analysis_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_analysis_runs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    run_type character varying(28) NOT NULL,
    period_start date,
    period_end date,
    status character varying(10) DEFAULT 'requested'::character varying NOT NULL,
    engine_version character varying(80),
    ingest_key text,
    failure_reason text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    generation_no integer DEFAULT 1 NOT NULL,
    superseded_at timestamp with time zone,
    CONSTRAINT ai_analysis_runs_check CHECK (((((run_type)::text = 'situational_recommendation'::text) AND (period_start IS NULL) AND (period_end IS NULL)) OR (((run_type)::text = 'plan_adjustment'::text) AND (period_start IS NOT NULL) AND (period_end >= period_start)) OR (((run_type)::text = 'weekly_report'::text) AND (period_start IS NOT NULL) AND (EXTRACT(isodow FROM period_start) = (1)::numeric) AND (period_end = (period_start + 6))) OR (((run_type)::text = 'monthly_report'::text) AND (period_start IS NOT NULL) AND (EXTRACT(day FROM period_start) = (1)::numeric) AND (period_end = (((period_start + '1 mon'::interval))::date - 1))))),
    CONSTRAINT ai_analysis_runs_check1 CHECK (((((status)::text = 'requested'::text) AND (completed_at IS NULL) AND (failure_reason IS NULL)) OR (((status)::text = 'completed'::text) AND (completed_at IS NOT NULL) AND (engine_version IS NOT NULL) AND (failure_reason IS NULL)) OR (((status)::text = 'failed'::text) AND (completed_at IS NOT NULL) AND (failure_reason IS NOT NULL) AND (length(btrim(failure_reason)) > 0)))),
    CONSTRAINT ai_analysis_runs_engine_version_check CHECK (((engine_version IS NULL) OR (length(btrim((engine_version)::text)) > 0))),
    CONSTRAINT ai_analysis_runs_generation_no_check CHECK ((generation_no > 0)),
    CONSTRAINT ai_analysis_runs_ingest_key_check CHECK (((ingest_key IS NULL) OR (length(btrim(ingest_key)) > 0))),
    CONSTRAINT ai_analysis_runs_run_type_check CHECK (((run_type)::text = ANY (ARRAY[('plan_adjustment'::character varying)::text, ('situational_recommendation'::character varying)::text, ('weekly_report'::character varying)::text, ('monthly_report'::character varying)::text]))),
    CONSTRAINT ai_analysis_runs_status_check CHECK (((status)::text = ANY (ARRAY[('requested'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT ai_runs_superseded_needs_completion CHECK (((superseded_at IS NULL) OR (((status)::text = 'completed'::text) AND (superseded_at >= completed_at))))
);


--
-- Name: ai_mission_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_mission_recommendations (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    run_type character varying(28) DEFAULT 'situational_recommendation'::character varying NOT NULL,
    user_id uuid NOT NULL,
    rank_no smallint NOT NULL,
    mission_definition_id uuid,
    suggestion_text character varying(200),
    reason text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(10) DEFAULT 'shown'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    decided_at timestamp with time zone,
    mission_id uuid,
    CONSTRAINT ai_mission_recommendations_check1 CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT ai_mission_recommendations_check2 CHECK ((((status)::text = 'shown'::text) = (decided_at IS NULL))),
    CONSTRAINT ai_mission_recommendations_context_check CHECK (((jsonb_typeof(context) = 'object'::text) AND (NOT (context ?| ARRAY['latitude'::text, 'longitude'::text, 'lat'::text, 'lng'::text, 'lon'::text])))),
    CONSTRAINT ai_mission_recommendations_rank_no_check CHECK (((rank_no >= 1) AND (rank_no <= 20))),
    CONSTRAINT ai_mission_recommendations_run_type_check CHECK (((run_type)::text = 'situational_recommendation'::text)),
    CONSTRAINT ai_mission_recommendations_status_check CHECK (((status)::text = ANY (ARRAY[('shown'::character varying)::text, ('accepted'::character varying)::text, ('dismissed'::character varying)::text, ('expired'::character varying)::text]))),
    CONSTRAINT ai_mission_recommendations_suggestion_text_check CHECK (((suggestion_text IS NULL) OR (length(btrim((suggestion_text)::text)) > 0))),
    CONSTRAINT ai_recommendation_has_target CHECK (((mission_id IS NOT NULL) OR (mission_definition_id IS NOT NULL) OR (suggestion_text IS NOT NULL)))
);


--
-- Name: ai_plan_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_plan_proposals (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    goal_id uuid NOT NULL,
    generation_no integer NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    proposal_json jsonb NOT NULL,
    accepted_plan_json jsonb,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT ai_plan_proposals_accepted_plan_json_check CHECK (((accepted_plan_json IS NULL) OR (jsonb_typeof(accepted_plan_json) = 'object'::text))),
    CONSTRAINT ai_plan_proposals_check CHECK ((((status)::text = 'accepted'::text) = ((accepted_at IS NOT NULL) AND (accepted_plan_json IS NOT NULL)))),
    CONSTRAINT ai_plan_proposals_generation_no_check CHECK ((generation_no > 0)),
    CONSTRAINT ai_plan_proposals_proposal_json_check CHECK ((jsonb_typeof(proposal_json) = 'object'::text)),
    CONSTRAINT ai_plan_proposals_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: ai_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reports (
    run_id uuid NOT NULL,
    run_type character varying(28) NOT NULL,
    user_id uuid NOT NULL,
    title character varying(160) NOT NULL,
    summary text NOT NULL,
    content_json jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    feedback text,
    next_goals jsonb,
    CONSTRAINT ai_reports_check CHECK (((read_at IS NULL) OR (read_at >= generated_at))),
    CONSTRAINT ai_reports_content_json_check CHECK ((jsonb_typeof(content_json) = 'object'::text)),
    CONSTRAINT ai_reports_next_goals_check CHECK (((next_goals IS NULL) OR (jsonb_typeof(next_goals) = ANY (ARRAY['object'::text, 'array'::text])))),
    CONSTRAINT ai_reports_run_type_check CHECK (((run_type)::text = ANY (ARRAY[('weekly_report'::character varying)::text, ('monthly_report'::character varying)::text]))),
    CONSTRAINT ai_reports_summary_check CHECK ((length(btrim(summary)) > 0)),
    CONSTRAINT ai_reports_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT auth_sessions_check CHECK ((expires_at > created_at)),
    CONSTRAINT auth_sessions_check1 CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT auth_sessions_refresh_token_hash_check CHECK ((length(refresh_token_hash) > 0))
);


--
-- Name: challenge_daily_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_daily_missions (
    id uuid NOT NULL,
    participation_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    challenge_date date NOT NULL,
    mission_id uuid NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    qualifying_record_id uuid,
    qualifying_result_id uuid,
    judged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_daily_missions_check CHECK ((((status)::text = 'success'::text) = ((qualifying_record_id IS NOT NULL) AND (qualifying_result_id IS NOT NULL)))),
    CONSTRAINT challenge_daily_missions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text, ('excluded'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: challenge_final_rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_final_rankings (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    participation_id uuid,
    rank_no integer NOT NULL,
    score integer NOT NULL,
    display_name character varying(32) NOT NULL,
    anonymized_at timestamp with time zone,
    CONSTRAINT challenge_final_rankings_check CHECK (((participation_id IS NULL) = (anonymized_at IS NOT NULL))),
    CONSTRAINT challenge_final_rankings_display_name_check CHECK ((length(btrim((display_name)::text)) > 0)),
    CONSTRAINT challenge_final_rankings_rank_no_check CHECK ((rank_no > 0)),
    CONSTRAINT challenge_final_rankings_score_check CHECK ((score >= 0))
);


--
-- Name: challenge_live_rankings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.challenge_live_rankings AS
SELECT
    NULL::uuid AS challenge_id,
    NULL::uuid AS participation_id,
    NULL::uuid AS user_id,
    NULL::character varying(12) AS display_name,
    NULL::integer AS successful_days,
    NULL::integer AS score,
    NULL::timestamp with time zone AS last_qualifying_submitted_at,
    NULL::bigint AS rank_no;


--
-- Name: challenge_moderation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_moderation_actions (
    id uuid NOT NULL,
    participation_id uuid NOT NULL,
    daily_mission_id uuid,
    admin_id uuid NOT NULL,
    action character varying(16) NOT NULL,
    reason text NOT NULL,
    evidence_result_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_moderation_actions_action_check CHECK (((action)::text = ANY (ARRAY[('disqualify'::character varying)::text, ('restore'::character varying)::text, ('exclude_day'::character varying)::text, ('restore_day'::character varying)::text]))),
    CONSTRAINT challenge_moderation_actions_check CHECK ((((action)::text = ANY (ARRAY[('exclude_day'::character varying)::text, ('restore_day'::character varying)::text])) = (daily_mission_id IS NOT NULL))),
    CONSTRAINT challenge_moderation_actions_reason_check CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: challenge_participations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participations (
    id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(16) DEFAULT 'enrolled'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    withdrawn_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_participations_check CHECK ((((status)::text = 'withdrawn'::text) = (withdrawn_at IS NOT NULL))),
    CONSTRAINT challenge_participations_check1 CHECK ((((status)::text = 'completed'::text) = (completed_at IS NOT NULL))),
    CONSTRAINT challenge_participations_status_check CHECK (((status)::text = ANY (ARRAY[('enrolled'::character varying)::text, ('withdrawn'::character varying)::text, ('disqualified'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: challenge_publication_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_publication_reviews (
    id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    requested_by_user_id uuid,
    reviewed_by_admin_id uuid,
    decision character varying(12) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_publication_reviews_check CHECK (((((decision)::text = 'submitted'::text) AND (reviewed_by_admin_id IS NULL)) OR (((decision)::text <> 'submitted'::text) AND (reviewed_by_admin_id IS NOT NULL)))),
    CONSTRAINT challenge_publication_reviews_check1 CHECK ((((decision)::text <> ALL (ARRAY[('rejected'::character varying)::text, ('hidden'::character varying)::text])) OR (length(btrim(reason)) > 0))),
    CONSTRAINT challenge_publication_reviews_decision_check CHECK (((decision)::text = ANY (ARRAY[('submitted'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('hidden'::character varying)::text])))
);


--
-- Name: challenge_reward_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_reward_grants (
    id uuid NOT NULL,
    participation_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    first_settlement_run_id uuid NOT NULL,
    promised_points integer NOT NULL,
    paid_points integer NOT NULL,
    user_xp integer NOT NULL,
    pet_xp integer NOT NULL,
    recipient_pet_id uuid,
    badge_grant_id uuid,
    status character varying(12) NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_reward_grants_check CHECK ((paid_points <= promised_points)),
    CONSTRAINT challenge_reward_grants_paid_points_check CHECK ((paid_points >= 0)),
    CONSTRAINT challenge_reward_grants_pet_xp_check CHECK ((pet_xp >= 0)),
    CONSTRAINT challenge_reward_grants_promised_points_check CHECK ((promised_points >= 0)),
    CONSTRAINT challenge_reward_grants_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text]))),
    CONSTRAINT challenge_reward_grants_user_xp_check CHECK ((user_xp >= 0))
);


--
-- Name: challenge_reward_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_reward_packages (
    challenge_id uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    user_xp integer DEFAULT 0 NOT NULL,
    pet_xp integer DEFAULT 0 NOT NULL,
    badge_achievement_version_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_reward_packages_pet_xp_check CHECK ((pet_xp >= 0)),
    CONSTRAINT challenge_reward_packages_points_check CHECK ((points >= 0)),
    CONSTRAINT challenge_reward_packages_user_xp_check CHECK ((user_xp >= 0))
);


--
-- Name: challenge_reward_payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_reward_payment_attempts (
    run_id uuid NOT NULL,
    participation_id uuid NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    last_attempt_at timestamp with time zone,
    next_retry_at timestamp with time zone,
    locked_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_reward_payment_attempts_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT challenge_reward_payment_attempts_check CHECK (((attempt_count = 0) OR (last_attempt_at IS NOT NULL)))
);


--
-- Name: challenge_rule_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_rule_events (
    id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    admin_id uuid,
    requested_by_user_id uuid,
    event_type character varying(20) NOT NULL,
    reason text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_rule_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('published'::character varying)::text, ('cancelled'::character varying)::text, ('hidden'::character varying)::text, ('rescheduled'::character varying)::text]))),
    CONSTRAINT challenge_rule_events_reason_check CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: challenge_score_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_score_snapshots (
    challenge_id uuid NOT NULL,
    participation_id uuid NOT NULL,
    successful_days integer NOT NULL,
    score integer GENERATED ALWAYS AS ((successful_days * 100)) STORED,
    last_qualifying_submitted_at timestamp with time zone,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_score_snapshots_check CHECK (((successful_days = 0) = (last_qualifying_submitted_at IS NULL))),
    CONSTRAINT challenge_score_snapshots_successful_days_check CHECK ((successful_days >= 0))
);


--
-- Name: TABLE challenge_score_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.challenge_score_snapshots IS '현재 사용하지 않음: 순위는 진행 중에는 challenge_live_rankings 뷰, 정산 확정 후에는 challenge_final_rankings 표가 담당한다. 앱 코드가 읽거나 쓰지 않으며 항상 비어 있는 것이 정상이다.';


--
-- Name: challenge_settlement_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_settlement_entries (
    run_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    participation_id uuid NOT NULL,
    successful_days integer NOT NULL,
    score integer GENERATED ALWAYS AS ((successful_days * 100)) STORED,
    last_qualifying_submitted_at timestamp with time zone,
    rank_no integer,
    outcome character varying(16) NOT NULL,
    exclusion_reason text,
    promised_points integer DEFAULT 0 NOT NULL,
    paid_points integer DEFAULT 0 NOT NULL,
    user_xp integer DEFAULT 0 NOT NULL,
    pet_xp integer DEFAULT 0 NOT NULL,
    payment_status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT challenge_settlement_entries_check CHECK ((paid_points <= promised_points)),
    CONSTRAINT challenge_settlement_entries_check1 CHECK (((successful_days = 0) = (last_qualifying_submitted_at IS NULL))),
    CONSTRAINT challenge_settlement_entries_check2 CHECK ((((outcome)::text = ANY (ARRAY[('withdrawn'::character varying)::text, ('disqualified'::character varying)::text])) = (rank_no IS NULL))),
    CONSTRAINT challenge_settlement_entries_check3 CHECK ((((outcome)::text = 'completed'::text) OR ((promised_points = 0) AND (paid_points = 0) AND (user_xp = 0) AND (pet_xp = 0)))),
    CONSTRAINT challenge_settlement_entries_outcome_check CHECK (((outcome)::text = ANY (ARRAY[('completed'::character varying)::text, ('failed'::character varying)::text, ('withdrawn'::character varying)::text, ('disqualified'::character varying)::text]))),
    CONSTRAINT challenge_settlement_entries_paid_points_check CHECK ((paid_points >= 0)),
    CONSTRAINT challenge_settlement_entries_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('failed'::character varying)::text, ('none'::character varying)::text]))),
    CONSTRAINT challenge_settlement_entries_pet_xp_check CHECK ((pet_xp >= 0)),
    CONSTRAINT challenge_settlement_entries_promised_points_check CHECK ((promised_points >= 0)),
    CONSTRAINT challenge_settlement_entries_rank_no_check CHECK ((rank_no > 0)),
    CONSTRAINT challenge_settlement_entries_successful_days_check CHECK ((successful_days >= 0)),
    CONSTRAINT challenge_settlement_entries_user_xp_check CHECK ((user_xp >= 0))
);


--
-- Name: challenge_settlement_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_settlement_runs (
    id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    run_no integer NOT NULL,
    status character varying(12) DEFAULT 'draft'::character varying NOT NULL,
    based_on_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_by_admin_id uuid,
    confirmed_at timestamp with time zone,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_settlement_runs_check CHECK (((((status)::text = 'draft'::text) AND (confirmed_at IS NULL) AND (confirmed_by_admin_id IS NULL)) OR (((status)::text <> 'draft'::text) AND (confirmed_at IS NOT NULL) AND (confirmed_by_admin_id IS NOT NULL) AND (reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT challenge_settlement_runs_run_no_check CHECK ((run_no > 0)),
    CONSTRAINT challenge_settlement_runs_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('confirmed'::character varying)::text, ('superseded'::character varying)::text])))
);


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid NOT NULL,
    origin character varying(8) NOT NULL,
    created_by_user_id uuid,
    created_by_admin_id uuid,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    category_id uuid NOT NULL,
    difficulty_id uuid NOT NULL,
    verification_method character varying(30) NOT NULL,
    target_value numeric(10,2),
    target_unit character varying(20),
    estimated_duration_seconds integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    required_success_days integer NOT NULL,
    max_participants integer,
    publication_status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    settlement_status character varying(16) DEFAULT 'not_started'::character varying NOT NULL,
    published_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercise_code character varying(20),
    CONSTRAINT challenges_check CHECK (((((origin)::text = 'admin'::text) AND (created_by_admin_id IS NOT NULL) AND (created_by_user_id IS NULL)) OR (((origin)::text = 'user'::text) AND (created_by_admin_id IS NULL)))),
    CONSTRAINT challenges_check1 CHECK (((target_value IS NULL) = (target_unit IS NULL))),
    CONSTRAINT challenges_check2 CHECK ((((end_date - start_date) + 1) = ANY (ARRAY[7, 14, 30]))),
    CONSTRAINT challenges_check3 CHECK ((required_success_days <= ((end_date - start_date) + 1))),
    CONSTRAINT challenges_check4 CHECK ((((publication_status)::text <> 'public'::text) OR (published_at IS NOT NULL))),
    CONSTRAINT challenges_check5 CHECK ((((publication_status)::text = 'cancelled'::text) = (cancelled_at IS NOT NULL))),
    CONSTRAINT challenges_description_check CHECK ((length(btrim(description)) > 0)),
    CONSTRAINT challenges_estimated_duration_seconds_check CHECK ((estimated_duration_seconds > 0)),
    CONSTRAINT challenges_exercise_code_check CHECK (((exercise_code)::text = ANY (ARRAY[('push_up'::character varying)::text, ('burpee'::character varying)::text, ('squat'::character varying)::text, ('lunge'::character varying)::text, ('plank'::character varying)::text, ('running'::character varying)::text]))),
    CONSTRAINT challenges_exercise_method_check CHECK (((exercise_code IS NULL) OR (((exercise_code)::text = 'running'::text) = ((verification_method)::text = 'sensor'::text)))),
    CONSTRAINT challenges_max_participants_check CHECK ((max_participants > 0)),
    CONSTRAINT challenges_origin_check CHECK (((origin)::text = ANY (ARRAY[('admin'::character varying)::text, ('user'::character varying)::text]))),
    CONSTRAINT challenges_publication_status_check CHECK (((publication_status)::text = ANY (ARRAY[('draft'::character varying)::text, ('review_pending'::character varying)::text, ('public'::character varying)::text, ('rejected'::character varying)::text, ('hidden'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT challenges_required_success_days_check CHECK ((required_success_days > 0)),
    CONSTRAINT challenges_settlement_status_check CHECK (((settlement_status)::text = ANY (ARRAY[('not_started'::character varying)::text, ('draft'::character varying)::text, ('confirmed'::character varying)::text]))),
    CONSTRAINT challenges_target_unit_check CHECK (((target_unit IS NULL) OR (length(btrim((target_unit)::text)) > 0))),
    CONSTRAINT challenges_target_value_check CHECK ((target_value > (0)::numeric)),
    CONSTRAINT challenges_title_check CHECK ((length(btrim((title)::text)) > 0)),
    CONSTRAINT challenges_verification_method_check CHECK (((verification_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('sensor'::character varying)::text])))
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    document_version_id uuid NOT NULL,
    granted boolean NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: difficulty_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.difficulty_levels (
    id uuid NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    display_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT difficulty_levels_code_check CHECK (((code)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT difficulty_levels_display_order_check CHECK ((display_order >= 0)),
    CONSTRAINT difficulty_levels_name_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: experience_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experience_awards (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_type character varying(16) NOT NULL,
    source_id uuid NOT NULL,
    recipient_pet_id uuid,
    base_user_xp integer NOT NULL,
    base_pet_xp integer NOT NULL,
    bonus_pet_xp integer DEFAULT 0 NOT NULL,
    pet_species_version_id uuid,
    pet_stage_no smallint,
    bonus_basis_points integer DEFAULT 0 NOT NULL,
    status character varying(12) NOT NULL,
    first_awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT experience_awards_base_pet_xp_check CHECK ((base_pet_xp >= 0)),
    CONSTRAINT experience_awards_base_user_xp_check CHECK ((base_user_xp >= 0)),
    CONSTRAINT experience_awards_bonus_basis_points_check CHECK (((bonus_basis_points >= 0) AND (bonus_basis_points <= 2000))),
    CONSTRAINT experience_awards_bonus_pet_xp_check CHECK ((bonus_pet_xp >= 0)),
    CONSTRAINT experience_awards_check CHECK ((bonus_pet_xp = ((((base_pet_xp)::bigint * bonus_basis_points) / 10000))::integer)),
    CONSTRAINT experience_awards_check1 CHECK ((((recipient_pet_id IS NULL) AND (bonus_pet_xp = 0) AND (bonus_basis_points = 0) AND (pet_stage_no IS NULL) AND (pet_species_version_id IS NULL)) OR ((recipient_pet_id IS NOT NULL) AND (pet_stage_no IS NOT NULL) AND (pet_species_version_id IS NOT NULL)))),
    CONSTRAINT experience_awards_check2 CHECK ((((source_type)::text = 'mission'::text) OR ((bonus_pet_xp = 0) AND (bonus_basis_points = 0)))),
    CONSTRAINT experience_awards_pet_stage_no_check CHECK (((pet_stage_no >= 1) AND (pet_stage_no <= 3))),
    CONSTRAINT experience_awards_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('mission'::character varying)::text, ('achievement'::character varying)::text, ('streak'::character varying)::text, ('challenge'::character varying)::text]))),
    CONSTRAINT experience_awards_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text])))
);


--
-- Name: experience_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experience_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipient_kind character varying(4) NOT NULL,
    user_pet_id uuid,
    experience_award_id uuid,
    xp_delta bigint NOT NULL,
    balance_after bigint NOT NULL,
    kind character varying(20) NOT NULL,
    original_transaction_id uuid,
    idempotency_key text NOT NULL,
    created_by_admin_id uuid,
    reason text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT experience_transactions_balance_after_check CHECK ((balance_after >= 0)),
    CONSTRAINT experience_transactions_check CHECK (((((recipient_kind)::text = 'user'::text) AND (user_pet_id IS NULL)) OR (((recipient_kind)::text = 'pet'::text) AND (user_pet_id IS NOT NULL)))),
    CONSTRAINT experience_transactions_check1 CHECK (((((kind)::text = 'admin_adjustment'::text) AND (created_by_admin_id IS NOT NULL) AND (reason IS NOT NULL) AND (length(btrim(reason)) > 0)) OR (((kind)::text <> 'admin_adjustment'::text) AND (experience_award_id IS NOT NULL)))),
    CONSTRAINT experience_transactions_check2 CHECK ((((kind)::text = ANY (ARRAY[('reversal'::character varying)::text, ('reinstatement'::character varying)::text])) = (original_transaction_id IS NOT NULL))),
    CONSTRAINT experience_transactions_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT experience_transactions_kind_check CHECK (((kind)::text = ANY (ARRAY[('award'::character varying)::text, ('reversal'::character varying)::text, ('reinstatement'::character varying)::text, ('admin_adjustment'::character varying)::text]))),
    CONSTRAINT experience_transactions_recipient_kind_check CHECK (((recipient_kind)::text = ANY (ARRAY[('user'::character varying)::text, ('pet'::character varying)::text]))),
    CONSTRAINT experience_transactions_xp_delta_check CHECK ((xp_delta <> 0))
);


--
-- Name: goal_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_categories (
    id uuid NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    display_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_categories_code_check CHECK (((code)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT goal_categories_display_order_check CHECK ((display_order >= 0)),
    CONSTRAINT goal_categories_name_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: goal_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_steps (
    id uuid NOT NULL,
    goal_id uuid NOT NULL,
    step_no integer NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    due_date date NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_steps_check CHECK ((((status)::text = 'completed'::text) = (completed_at IS NOT NULL))),
    CONSTRAINT goal_steps_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT goal_steps_step_no_check CHECK ((step_no > 0)),
    CONSTRAINT goal_steps_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    difficulty_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    target_frequency smallint,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    daily_available_minutes smallint,
    CONSTRAINT goals_check CHECK ((end_date >= start_date)),
    CONSTRAINT goals_check1 CHECK ((((status)::text = 'completed'::text) = (completed_at IS NOT NULL))),
    CONSTRAINT goals_daily_available_minutes_check CHECK (((daily_available_minutes >= 5) AND (daily_available_minutes <= 240))),
    CONSTRAINT goals_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('paused'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT goals_target_frequency_check CHECK (((target_frequency >= 1) AND (target_frequency <= 7))),
    CONSTRAINT goals_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    record_id uuid NOT NULL,
    object_key text NOT NULL,
    media_kind character varying(24) NOT NULL,
    mime_type character varying(100) NOT NULL,
    expected_size_bytes bigint NOT NULL,
    actual_size_bytes bigint,
    checksum_sha256 character(64),
    upload_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    upload_url_expires_at timestamp with time zone NOT NULL,
    uploaded_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_files_actual_size_bytes_check CHECK ((actual_size_bytes > 0)),
    CONSTRAINT media_files_check CHECK ((upload_url_expires_at > created_at)),
    CONSTRAINT media_files_check1 CHECK (((((upload_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('failed'::character varying)::text])) AND (uploaded_at IS NULL) AND (deleted_at IS NULL)) OR (((upload_status)::text = ANY (ARRAY[('uploaded'::character varying)::text, ('deleting'::character varying)::text])) AND (uploaded_at IS NOT NULL) AND (actual_size_bytes IS NOT NULL) AND (deleted_at IS NULL)) OR (((upload_status)::text = 'deleted'::text) AND (deleted_at IS NOT NULL)))),
    CONSTRAINT media_files_checksum_sha256_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT media_files_expected_size_bytes_check CHECK ((expected_size_bytes > 0)),
    CONSTRAINT media_files_media_kind_check CHECK (((media_kind)::text = ANY (ARRAY[('camera_photo'::character varying)::text, ('camera_video'::character varying)::text, ('sensor_raw'::character varying)::text]))),
    CONSTRAINT media_files_mime_type_check CHECK ((length(btrim((mime_type)::text)) > 0)),
    CONSTRAINT media_files_object_key_check CHECK ((length(object_key) > 0)),
    CONSTRAINT media_files_upload_status_check CHECK (((upload_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('uploaded'::character varying)::text, ('failed'::character varying)::text, ('deleting'::character varying)::text, ('deleted'::character varying)::text])))
);


--
-- Name: mission_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_definitions (
    id uuid NOT NULL,
    origin character varying(20) NOT NULL,
    created_by_user_id uuid,
    title character varying(200) NOT NULL,
    description text,
    category_id uuid NOT NULL,
    difficulty_id uuid NOT NULL,
    estimated_duration_seconds integer,
    target_value numeric(10,2),
    target_unit character varying(20),
    verification_method character varying(30) NOT NULL,
    publication_status character varying(24) NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercise_code character varying(20),
    base_points integer DEFAULT 0 NOT NULL,
    base_user_xp integer DEFAULT 0 NOT NULL,
    base_pet_xp integer DEFAULT 0 NOT NULL,
    CONSTRAINT mission_definitions_base_pet_xp_check CHECK ((base_pet_xp >= 0)),
    CONSTRAINT mission_definitions_base_points_check CHECK ((base_points >= 0)),
    CONSTRAINT mission_definitions_base_user_xp_check CHECK ((base_user_xp >= 0)),
    CONSTRAINT mission_definitions_check CHECK (((target_value IS NULL) = (target_unit IS NULL))),
    CONSTRAINT mission_definitions_check1 CHECK ((((origin)::text <> 'admin'::text) OR (created_by_user_id IS NULL))),
    CONSTRAINT mission_definitions_check2 CHECK ((((origin)::text <> 'user'::text) OR ((publication_status)::text <> 'draft'::text))),
    CONSTRAINT mission_definitions_check3 CHECK ((((origin)::text <> 'user'::text) OR (created_by_user_id IS NOT NULL) OR ((publication_status)::text = 'public'::text))),
    CONSTRAINT mission_definitions_estimated_duration_seconds_check CHECK ((estimated_duration_seconds > 0)),
    CONSTRAINT mission_definitions_exercise_code_check CHECK (((exercise_code)::text = ANY (ARRAY[('push_up'::character varying)::text, ('burpee'::character varying)::text, ('squat'::character varying)::text, ('lunge'::character varying)::text, ('plank'::character varying)::text, ('running'::character varying)::text]))),
    CONSTRAINT mission_definitions_exercise_method_check CHECK (((exercise_code IS NULL) OR (((exercise_code)::text = 'running'::text) = ((verification_method)::text = 'sensor'::text)))),
    CONSTRAINT mission_definitions_origin_check CHECK (((origin)::text = ANY (ARRAY[('admin'::character varying)::text, ('user'::character varying)::text]))),
    CONSTRAINT mission_definitions_publication_status_check CHECK (((publication_status)::text = ANY (ARRAY[('draft'::character varying)::text, ('private'::character varying)::text, ('review_pending'::character varying)::text, ('public'::character varying)::text, ('rejected'::character varying)::text, ('hidden'::character varying)::text]))),
    CONSTRAINT mission_definitions_target_unit_check CHECK (((target_unit IS NULL) OR (length(btrim((target_unit)::text)) > 0))),
    CONSTRAINT mission_definitions_target_value_check CHECK ((target_value > (0)::numeric)),
    CONSTRAINT mission_definitions_title_check CHECK ((length(btrim((title)::text)) > 0)),
    CONSTRAINT mission_definitions_verification_method_check CHECK (((verification_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('sensor'::character varying)::text])))
);


--
-- Name: mission_point_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_point_awards (
    mission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    first_approved_result_id uuid NOT NULL,
    original_points integer NOT NULL,
    paid_points integer NOT NULL,
    status character varying(16) NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_point_awards_check CHECK ((paid_points <= original_points)),
    CONSTRAINT mission_point_awards_original_points_check CHECK ((original_points >= 0)),
    CONSTRAINT mission_point_awards_paid_points_check CHECK ((paid_points >= 0)),
    CONSTRAINT mission_point_awards_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text])))
);


--
-- Name: mission_publication_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_publication_reviews (
    id uuid NOT NULL,
    definition_id uuid NOT NULL,
    requested_by_user_id uuid,
    reviewed_by_admin_id uuid,
    decision character varying(20) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_publication_reviews_check CHECK (((((decision)::text = 'submitted'::text) AND (reviewed_by_admin_id IS NULL)) OR (((decision)::text <> 'submitted'::text) AND (reviewed_by_admin_id IS NOT NULL)))),
    CONSTRAINT mission_publication_reviews_check1 CHECK ((((decision)::text <> ALL (ARRAY[('rejected'::character varying)::text, ('hidden'::character varying)::text])) OR ((reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT mission_publication_reviews_decision_check CHECK (((decision)::text = ANY (ARRAY[('submitted'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('hidden'::character varying)::text])))
);


--
-- Name: mission_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_records (
    id uuid NOT NULL,
    mission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    submission_no smallint,
    status character varying(24) DEFAULT 'recording'::character varying NOT NULL,
    evidence_kind character varying(20),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    completed_at timestamp with time zone,
    metrics jsonb,
    reward_pet_id uuid,
    reward_pet_stage_no smallint,
    reward_pet_bonus_basis_points integer DEFAULT 0 NOT NULL,
    CONSTRAINT mission_records_attempt_no_check CHECK ((attempt_no > 0)),
    CONSTRAINT mission_records_check CHECK (((submission_no IS NULL) = (submitted_at IS NULL))),
    CONSTRAINT mission_records_check1 CHECK (((((status)::text = ANY (ARRAY[('recording'::character varying)::text, ('uploading'::character varying)::text, ('aborted'::character varying)::text])) AND (submission_no IS NULL)) OR (((status)::text = ANY (ARRAY[('submitted'::character varying)::text, ('review_required'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('superseded'::character varying)::text])) AND (submission_no IS NOT NULL) AND (evidence_kind IS NOT NULL)))),
    CONSTRAINT mission_records_check2 CHECK (((submitted_at IS NULL) OR (submitted_at >= started_at))),
    CONSTRAINT mission_records_check3 CHECK (((completed_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT mission_records_check4 CHECK ((((status)::text <> ALL (ARRAY[('approved'::character varying)::text, ('rejected'::character varying)::text, ('superseded'::character varying)::text])) OR (completed_at IS NOT NULL))),
    CONSTRAINT mission_records_evidence_kind_check CHECK (((evidence_kind)::text = ANY (ARRAY[('camera_media'::character varying)::text, ('sensor_raw'::character varying)::text, ('sensor_summary'::character varying)::text]))),
    CONSTRAINT mission_records_metrics_check CHECK (((metrics IS NULL) OR (jsonb_typeof(metrics) = 'object'::text))),
    CONSTRAINT mission_records_pet_snapshot_check CHECK ((((reward_pet_id IS NULL) AND (reward_pet_stage_no IS NULL) AND (reward_pet_bonus_basis_points = 0)) OR ((reward_pet_id IS NOT NULL) AND (reward_pet_stage_no IS NOT NULL)))),
    CONSTRAINT mission_records_reward_pet_bonus_basis_points_check CHECK (((reward_pet_bonus_basis_points >= 0) AND (reward_pet_bonus_basis_points <= 2000))),
    CONSTRAINT mission_records_reward_pet_stage_no_check CHECK (((reward_pet_stage_no >= 1) AND (reward_pet_stage_no <= 3))),
    CONSTRAINT mission_records_status_check CHECK (((status)::text = ANY (ARRAY[('recording'::character varying)::text, ('uploading'::character varying)::text, ('submitted'::character varying)::text, ('review_required'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('superseded'::character varying)::text, ('aborted'::character varying)::text]))),
    CONSTRAINT mission_records_submission_no_check CHECK (((submission_no >= 1) AND (submission_no <= 4)))
);


--
-- Name: mission_reward_rate_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_reward_rate_versions (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    difficulty_id uuid NOT NULL,
    version_no integer NOT NULL,
    points integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_xp integer DEFAULT 0 NOT NULL,
    pet_xp integer DEFAULT 0 NOT NULL,
    CONSTRAINT mission_reward_rate_versions_pet_xp_check CHECK ((pet_xp >= 0)),
    CONSTRAINT mission_reward_rate_versions_points_check CHECK ((points >= 0)),
    CONSTRAINT mission_reward_rate_versions_user_xp_check CHECK ((user_xp >= 0)),
    CONSTRAINT mission_reward_rate_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    goal_id uuid,
    goal_step_id uuid,
    definition_id uuid,
    source_proposal_id uuid,
    source_type character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    category_id uuid NOT NULL,
    difficulty_id uuid NOT NULL,
    target_value numeric(10,2),
    target_unit character varying(20),
    estimated_duration_seconds integer,
    verification_method character varying(30) NOT NULL,
    scheduled_date date NOT NULL,
    due_at timestamp with time zone,
    is_required boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    memo text,
    cancel_reason character varying(30),
    cancelled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercise_code character varying(20),
    reward_points integer DEFAULT 0 NOT NULL,
    reward_rate_version_id uuid,
    reward_user_xp integer DEFAULT 0 NOT NULL,
    reward_pet_xp integer DEFAULT 0 NOT NULL,
    CONSTRAINT challenge_mission_no_daily_reward CHECK ((((source_type)::text <> 'challenge'::text) OR ((goal_id IS NULL) AND (goal_step_id IS NULL) AND (definition_id IS NULL) AND (source_proposal_id IS NULL) AND (reward_points = 0) AND (reward_user_xp = 0) AND (reward_pet_xp = 0)))),
    CONSTRAINT missions_cancel_reason_check CHECK (((cancel_reason IS NULL) OR (length(btrim((cancel_reason)::text)) > 0))),
    CONSTRAINT missions_check CHECK (((goal_step_id IS NULL) OR (goal_id IS NOT NULL))),
    CONSTRAINT missions_check1 CHECK (((target_value IS NULL) = (target_unit IS NULL))),
    CONSTRAINT missions_check2 CHECK (((((source_type)::text = 'ai'::text) AND (source_proposal_id IS NOT NULL)) OR (((source_type)::text <> 'ai'::text) AND (source_proposal_id IS NULL)))),
    CONSTRAINT missions_check3 CHECK ((((source_type)::text <> 'template'::text) OR (definition_id IS NOT NULL))),
    CONSTRAINT missions_check4 CHECK (((((status)::text = 'cancelled'::text) AND (cancelled_at IS NOT NULL) AND (cancel_reason IS NOT NULL)) OR (((status)::text <> 'cancelled'::text) AND (cancelled_at IS NULL) AND (cancel_reason IS NULL)))),
    CONSTRAINT missions_estimated_duration_seconds_check CHECK ((estimated_duration_seconds > 0)),
    CONSTRAINT missions_exercise_code_check CHECK (((exercise_code)::text = ANY (ARRAY[('push_up'::character varying)::text, ('burpee'::character varying)::text, ('squat'::character varying)::text, ('lunge'::character varying)::text, ('plank'::character varying)::text, ('running'::character varying)::text]))),
    CONSTRAINT missions_exercise_method_check CHECK (((exercise_code IS NULL) OR (((exercise_code)::text = 'running'::text) = ((verification_method)::text = 'sensor'::text)))),
    CONSTRAINT missions_reward_pet_xp_check CHECK ((reward_pet_xp >= 0)),
    CONSTRAINT missions_reward_points_check CHECK ((reward_points >= 0)),
    CONSTRAINT missions_reward_user_xp_check CHECK ((reward_user_xp >= 0)),
    CONSTRAINT missions_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('user'::character varying)::text, ('template'::character varying)::text, ('ai'::character varying)::text, ('challenge'::character varying)::text]))),
    CONSTRAINT missions_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('in_progress'::character varying)::text, ('submitted'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT missions_target_unit_check CHECK (((target_unit IS NULL) OR (length(btrim((target_unit)::text)) > 0))),
    CONSTRAINT missions_target_value_check CHECK ((target_value > (0)::numeric)),
    CONSTRAINT missions_title_check CHECK ((length(btrim((title)::text)) > 0)),
    CONSTRAINT missions_verification_method_check CHECK (((verification_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('sensor'::character varying)::text])))
);


--
-- Name: notice_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notice_recipients (
    notice_id uuid NOT NULL,
    audience_type character varying(8) DEFAULT 'users'::character varying NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT notice_recipients_audience_type_check CHECK (((audience_type)::text = 'users'::text))
);


--
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id uuid NOT NULL,
    category character varying(12) NOT NULL,
    title character varying(120) NOT NULL,
    body text NOT NULL,
    link_screen character varying(80),
    audience_type character varying(8) DEFAULT 'all'::character varying NOT NULL,
    show_in_list boolean DEFAULT true NOT NULL,
    send_push boolean DEFAULT false NOT NULL,
    policy_document_version_id uuid,
    status character varying(12) DEFAULT 'draft'::character varying NOT NULL,
    scheduled_at timestamp with time zone,
    published_at timestamp with time zone,
    fanout_completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notices_audience_type_check CHECK (((audience_type)::text = ANY (ARRAY[('all'::character varying)::text, ('users'::character varying)::text]))),
    CONSTRAINT notices_body_check CHECK ((length(btrim(body)) > 0)),
    CONSTRAINT notices_category_check CHECK (((category)::text = ANY (ARRAY[('service'::character varying)::text, ('event'::character varying)::text, ('policy'::character varying)::text, ('marketing'::character varying)::text]))),
    CONSTRAINT notices_check CHECK ((show_in_list OR send_push)),
    CONSTRAINT notices_check1 CHECK ((((category)::text = 'policy'::text) = (policy_document_version_id IS NOT NULL))),
    CONSTRAINT notices_check2 CHECK (((((status)::text = 'draft'::text) AND (published_at IS NULL) AND (cancelled_at IS NULL) AND (fanout_completed_at IS NULL)) OR (((status)::text = 'scheduled'::text) AND (scheduled_at IS NOT NULL) AND (published_at IS NULL) AND (cancelled_at IS NULL) AND (fanout_completed_at IS NULL)) OR (((status)::text = 'published'::text) AND (published_at IS NOT NULL) AND (cancelled_at IS NULL) AND ((fanout_completed_at IS NULL) OR (fanout_completed_at >= published_at))) OR (((status)::text = 'cancelled'::text) AND (cancelled_at IS NOT NULL) AND (published_at IS NULL) AND (fanout_completed_at IS NULL)))),
    CONSTRAINT notices_link_screen_check CHECK (((link_screen)::text ~ '^[a-z][a-z0-9_/.-]*$'::text)),
    CONSTRAINT notices_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('scheduled'::character varying)::text, ('published'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT notices_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: pending_pet_experience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_pet_experience (
    experience_award_id uuid NOT NULL,
    user_id uuid NOT NULL,
    base_pet_xp integer NOT NULL,
    status character varying(12) NOT NULL,
    assigned_pet_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_at timestamp with time zone,
    CONSTRAINT pending_pet_experience_base_pet_xp_check CHECK ((base_pet_xp >= 0)),
    CONSTRAINT pending_pet_experience_check CHECK ((((status)::text = 'assigned'::text) = ((assigned_pet_id IS NOT NULL) AND (assigned_at IS NOT NULL)))),
    CONSTRAINT pending_pet_experience_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('assigned'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: pet_evolution_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_evolution_events (
    id uuid NOT NULL,
    user_pet_id uuid NOT NULL,
    from_stage_no smallint NOT NULL,
    to_stage_no smallint NOT NULL,
    total_xp_after bigint NOT NULL,
    reason character varying(24) NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pet_evolution_events_check CHECK ((abs((to_stage_no - from_stage_no)) = 1)),
    CONSTRAINT pet_evolution_events_from_stage_no_check CHECK (((from_stage_no >= 1) AND (from_stage_no <= 3))),
    CONSTRAINT pet_evolution_events_reason_check CHECK (((reason)::text = ANY (ARRAY[('growth'::character varying)::text, ('reversal'::character varying)::text, ('reinstatement'::character varying)::text]))),
    CONSTRAINT pet_evolution_events_to_stage_no_check CHECK (((to_stage_no >= 1) AND (to_stage_no <= 3))),
    CONSTRAINT pet_evolution_events_total_xp_after_check CHECK ((total_xp_after >= 0))
);


--
-- Name: pet_level_policy_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_level_policy_versions (
    id uuid NOT NULL,
    version_no integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pet_level_policy_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: pet_level_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_level_thresholds (
    policy_version_id uuid NOT NULL,
    level_no integer NOT NULL,
    min_total_xp bigint NOT NULL,
    CONSTRAINT pet_level_thresholds_check CHECK (((level_no <> 1) OR (min_total_xp = 0))),
    CONSTRAINT pet_level_thresholds_level_no_check CHECK ((level_no > 0)),
    CONSTRAINT pet_level_thresholds_min_total_xp_check CHECK ((min_total_xp >= 0))
);


--
-- Name: pet_species; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_species (
    id uuid NOT NULL,
    code character varying(80) NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    status character varying(12) DEFAULT 'draft'::character varying NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pet_species_code_check CHECK (((code)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT pet_species_name_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT pet_species_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('public'::character varying)::text, ('hidden'::character varying)::text])))
);


--
-- Name: pet_species_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_species_versions (
    id uuid NOT NULL,
    species_id uuid NOT NULL,
    version_no integer NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    personality text,
    world_text text,
    category_id uuid NOT NULL,
    unlock_condition_type character varying(40) NOT NULL,
    unlock_target_count integer,
    unlock_category_id uuid,
    unlock_achievement_id uuid,
    hatch_mission_count integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pet_species_versions_check CHECK (((((unlock_condition_type)::text = 'none'::text) AND (unlock_target_count IS NULL) AND (unlock_category_id IS NULL) AND (unlock_achievement_id IS NULL)) OR (((unlock_condition_type)::text = 'approved_mission_count'::text) AND (unlock_target_count > 0) AND (unlock_category_id IS NULL) AND (unlock_achievement_id IS NULL)) OR (((unlock_condition_type)::text = 'category_approved_mission_count'::text) AND (unlock_target_count > 0) AND (unlock_category_id IS NOT NULL) AND (unlock_achievement_id IS NULL)) OR (((unlock_condition_type)::text = 'streak_milestone'::text) AND (unlock_target_count = ANY (ARRAY[7, 30, 100])) AND (unlock_category_id IS NULL) AND (unlock_achievement_id IS NULL)) OR (((unlock_condition_type)::text = 'achievement_earned'::text) AND (unlock_target_count IS NULL) AND (unlock_category_id IS NULL) AND (unlock_achievement_id IS NOT NULL)))),
    CONSTRAINT pet_species_versions_hatch_mission_count_check CHECK ((hatch_mission_count >= 0)),
    CONSTRAINT pet_species_versions_name_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT pet_species_versions_unlock_condition_type_check CHECK (((unlock_condition_type)::text = ANY (ARRAY[('none'::character varying)::text, ('approved_mission_count'::character varying)::text, ('category_approved_mission_count'::character varying)::text, ('streak_milestone'::character varying)::text, ('achievement_earned'::character varying)::text]))),
    CONSTRAINT pet_species_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: pet_stage_dialogues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_stage_dialogues (
    species_version_id uuid NOT NULL,
    stage_no smallint NOT NULL,
    dialogue_no integer NOT NULL,
    text_content text NOT NULL,
    time_of_day character varying(12),
    situation_code character varying(40),
    display_order integer NOT NULL,
    CONSTRAINT pet_stage_dialogues_dialogue_no_check CHECK ((dialogue_no > 0)),
    CONSTRAINT pet_stage_dialogues_display_order_check CHECK ((display_order > 0)),
    CONSTRAINT pet_stage_dialogues_text_content_check CHECK ((length(btrim(text_content)) > 0)),
    CONSTRAINT pet_stage_dialogues_time_of_day_check CHECK (((time_of_day)::text = ANY (ARRAY[('morning'::character varying)::text, ('afternoon'::character varying)::text, ('evening'::character varying)::text, ('night'::character varying)::text])))
);


--
-- Name: pet_stage_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_stage_images (
    id uuid NOT NULL,
    species_id uuid NOT NULL,
    r2_object_key text NOT NULL,
    mime_type character varying(40) NOT NULL,
    size_bytes bigint NOT NULL,
    uploaded_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pet_stage_images_mime_type_check CHECK (((mime_type)::text = ANY (ARRAY[('image/png'::character varying)::text, ('image/jpeg'::character varying)::text, ('image/webp'::character varying)::text]))),
    CONSTRAINT pet_stage_images_r2_object_key_check CHECK ((length(btrim(r2_object_key)) > 0)),
    CONSTRAINT pet_stage_images_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: pet_stage_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_stage_versions (
    species_version_id uuid NOT NULL,
    species_id uuid NOT NULL,
    stage_no smallint NOT NULL,
    stage_code character varying(8) NOT NULL,
    min_total_xp bigint NOT NULL,
    bonus_basis_points integer NOT NULL,
    image_id uuid NOT NULL,
    CONSTRAINT pet_stage_versions_bonus_basis_points_check CHECK (((bonus_basis_points >= 0) AND (bonus_basis_points <= 2000))),
    CONSTRAINT pet_stage_versions_check CHECK ((((stage_no = 1) AND ((stage_code)::text = 'egg'::text) AND (min_total_xp = 0)) OR ((stage_no = 2) AND ((stage_code)::text = 'baby'::text) AND (min_total_xp > 0)) OR ((stage_no = 3) AND ((stage_code)::text = 'adult'::text) AND (min_total_xp > 0)))),
    CONSTRAINT pet_stage_versions_min_total_xp_check CHECK ((min_total_xp >= 0)),
    CONSTRAINT pet_stage_versions_stage_code_check CHECK (((stage_code)::text = ANY (ARRAY[('egg'::character varying)::text, ('baby'::character varying)::text, ('adult'::character varying)::text]))),
    CONSTRAINT pet_stage_versions_stage_no_check CHECK (((stage_no >= 1) AND (stage_no <= 3)))
);


--
-- Name: phone_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_credentials (
    user_id uuid NOT NULL,
    phone_e164 character varying(16) NOT NULL,
    password_hash text NOT NULL,
    verified_at timestamp with time zone NOT NULL,
    password_changed_at timestamp with time zone NOT NULL,
    failed_attempt_count smallint DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    CONSTRAINT phone_credentials_failed_attempt_count_check CHECK (((failed_attempt_count >= 0) AND (failed_attempt_count <= 5))),
    CONSTRAINT phone_credentials_password_hash_check CHECK ((length(password_hash) > 0)),
    CONSTRAINT phone_credentials_phone_e164_check CHECK (((phone_e164)::text ~ '^\+[1-9][0-9]{1,14}$'::text))
);


--
-- Name: phone_verification_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_verification_challenges (
    id uuid NOT NULL,
    phone_e164 character varying(16) NOT NULL,
    purpose character varying(24) NOT NULL,
    code_hash text NOT NULL,
    attempt_count smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    CONSTRAINT phone_verification_challenges_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT phone_verification_challenges_check CHECK ((expires_at > created_at)),
    CONSTRAINT phone_verification_challenges_check1 CHECK (((consumed_at IS NULL) OR (consumed_at >= created_at))),
    CONSTRAINT phone_verification_challenges_check2 CHECK (((invalidated_at IS NULL) OR (invalidated_at >= created_at))),
    CONSTRAINT phone_verification_challenges_check3 CHECK (((consumed_at IS NULL) OR (invalidated_at IS NULL))),
    CONSTRAINT phone_verification_challenges_code_hash_check CHECK ((length(code_hash) > 0)),
    CONSTRAINT phone_verification_challenges_phone_e164_check CHECK (((phone_e164)::text ~ '^\+[1-9][0-9]{1,14}$'::text)),
    CONSTRAINT phone_verification_challenges_purpose_check CHECK (((purpose)::text = ANY (ARRAY[('signup'::character varying)::text, ('link_phone'::character varying)::text, ('reset_password'::character varying)::text, ('change_phone'::character varying)::text])))
);


--
-- Name: plan_adjustment_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_adjustment_proposals (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    run_type character varying(28) DEFAULT 'plan_adjustment'::character varying NOT NULL,
    user_id uuid NOT NULL,
    goal_id uuid NOT NULL,
    status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    proposal_json jsonb NOT NULL,
    accepted_plan_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    decided_at timestamp with time zone,
    before_plan jsonb NOT NULL,
    reason text,
    CONSTRAINT plan_adjustment_proposals_accepted_plan_json_check CHECK (((accepted_plan_json IS NULL) OR (jsonb_typeof(accepted_plan_json) = 'object'::text))),
    CONSTRAINT plan_adjustment_proposals_before_plan_check CHECK ((jsonb_typeof(before_plan) = 'object'::text)),
    CONSTRAINT plan_adjustment_proposals_check CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT plan_adjustment_proposals_check1 CHECK (((((status)::text = 'proposed'::text) AND (decided_at IS NULL) AND (accepted_plan_json IS NULL)) OR (((status)::text = 'accepted'::text) AND (decided_at IS NOT NULL) AND (accepted_plan_json IS NOT NULL)) OR (((status)::text = ANY (ARRAY[('rejected'::character varying)::text, ('expired'::character varying)::text])) AND (decided_at IS NOT NULL) AND (accepted_plan_json IS NULL)))),
    CONSTRAINT plan_adjustment_proposals_proposal_json_check CHECK ((jsonb_typeof(proposal_json) = 'object'::text)),
    CONSTRAINT plan_adjustment_proposals_run_type_check CHECK (((run_type)::text = 'plan_adjustment'::text)),
    CONSTRAINT plan_adjustment_proposals_status_check CHECK (((status)::text = ANY (ARRAY[('proposed'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: point_monthly_cap_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_monthly_cap_policies (
    id uuid NOT NULL,
    effective_month date NOT NULL,
    monthly_limit_points integer NOT NULL,
    created_by_admin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_monthly_cap_policies_check CHECK (((created_by_admin_id IS NOT NULL) OR (id = '00000000-0000-0000-0000-000000000004'::uuid))),
    CONSTRAINT point_monthly_cap_policies_effective_month_check CHECK ((EXTRACT(day FROM effective_month) = (1)::numeric)),
    CONSTRAINT point_monthly_cap_policies_monthly_limit_points_check CHECK ((monthly_limit_points >= 0))
);


--
-- Name: point_monthly_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_monthly_usage (
    user_id uuid NOT NULL,
    month_start_date date NOT NULL,
    gross_auto_awarded_points bigint DEFAULT 0 NOT NULL,
    same_month_recovered_points bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_monthly_usage_check CHECK ((same_month_recovered_points <= gross_auto_awarded_points)),
    CONSTRAINT point_monthly_usage_gross_auto_awarded_points_check CHECK ((gross_auto_awarded_points >= 0)),
    CONSTRAINT point_monthly_usage_month_start_date_check CHECK ((EXTRACT(day FROM month_start_date) = (1)::numeric)),
    CONSTRAINT point_monthly_usage_same_month_recovered_points_check CHECK ((same_month_recovered_points >= 0))
);


--
-- Name: point_recovery_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_recovery_claims (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    mission_id uuid,
    original_award_transaction_id uuid NOT NULL,
    target_points bigint NOT NULL,
    outstanding_points bigint NOT NULL,
    settled_points bigint DEFAULT 0 NOT NULL,
    is_cancelled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    challenge_reward_grant_id uuid,
    streak_milestone_award_id uuid,
    user_achievement_id uuid,
    CONSTRAINT point_recovery_claims_check CHECK (((outstanding_points + settled_points) <= target_points)),
    CONSTRAINT point_recovery_claims_check1 CHECK ((is_cancelled = (cancelled_at IS NOT NULL))),
    CONSTRAINT point_recovery_claims_outstanding_points_check CHECK ((outstanding_points >= 0)),
    CONSTRAINT point_recovery_claims_settled_points_check CHECK ((settled_points >= 0)),
    CONSTRAINT point_recovery_claims_target_points_check CHECK ((target_points > 0)),
    CONSTRAINT point_recovery_exactly_one_source CHECK ((num_nonnulls(mission_id, challenge_reward_grant_id, streak_milestone_award_id, user_achievement_id) = 1))
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(32) NOT NULL,
    available_delta bigint DEFAULT 0 NOT NULL,
    outstanding_delta bigint DEFAULT 0 NOT NULL,
    balance_after bigint NOT NULL,
    outstanding_after bigint NOT NULL,
    source_type character varying(32) NOT NULL,
    source_id uuid NOT NULL,
    original_transaction_id uuid,
    recovery_claim_id uuid,
    cap_month date,
    cap_delta bigint DEFAULT 0 NOT NULL,
    idempotency_key text NOT NULL,
    created_by_admin_id uuid,
    reason text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_transactions_balance_after_check CHECK ((balance_after >= 0)),
    CONSTRAINT point_transactions_check CHECK (((available_delta <> 0) OR (outstanding_delta <> 0) OR (cap_delta <> 0))),
    CONSTRAINT point_transactions_check1 CHECK ((((cap_month IS NULL) AND (cap_delta = 0)) OR ((cap_month IS NOT NULL) AND (cap_delta <> 0) AND (EXTRACT(day FROM cap_month) = (1)::numeric)))),
    CONSTRAINT point_transactions_check2 CHECK ((((source_type)::text <> 'admin_adjustment'::text) OR ((created_by_admin_id IS NOT NULL) AND (reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT point_transactions_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT point_transactions_kind_check CHECK (((kind)::text = ANY (ARRAY[('auto_award'::character varying)::text, ('award_offset'::character varying)::text, ('spend'::character varying)::text, ('refund'::character varying)::text, ('refund_offset'::character varying)::text, ('recovery'::character varying)::text, ('recovery_claim'::character varying)::text, ('recovery_settlement'::character varying)::text, ('recovery_cancel'::character varying)::text, ('reinstatement'::character varying)::text, ('manual_grant'::character varying)::text, ('manual_recovery'::character varying)::text]))),
    CONSTRAINT point_transactions_outstanding_after_check CHECK ((outstanding_after >= 0)),
    CONSTRAINT point_transactions_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('mission'::character varying)::text, ('streak'::character varying)::text, ('achievement'::character varying)::text, ('challenge'::character varying)::text, ('shop_order'::character varying)::text, ('admin_adjustment'::character varying)::text])))
);


--
-- Name: point_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_wallets (
    user_id uuid NOT NULL,
    available_points bigint DEFAULT 0 NOT NULL,
    outstanding_recovery_points bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_wallets_available_points_check CHECK ((available_points >= 0)),
    CONSTRAINT point_wallets_outstanding_recovery_points_check CHECK ((outstanding_recovery_points >= 0))
);


--
-- Name: policy_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_document_versions (
    id uuid NOT NULL,
    document_type character varying(24) NOT NULL,
    version character varying(40) NOT NULL,
    body text NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    requires_reconsent boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT policy_document_versions_body_check CHECK ((length(body) > 0)),
    CONSTRAINT policy_document_versions_document_type_check CHECK (((document_type)::text = ANY (ARRAY[('terms'::character varying)::text, ('privacy'::character varying)::text, ('marketing'::character varying)::text]))),
    CONSTRAINT policy_document_versions_version_check CHECK ((length((version)::text) > 0))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    nickname character varying(12) NOT NULL,
    notification_enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    representative_achievement_id uuid,
    representative_pet_id uuid,
    CONSTRAINT profiles_nickname_check CHECK (((nickname)::text ~ '^[가-힣A-Za-z0-9]{2,12}$'::text))
);


--
-- Name: push_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_devices (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    platform character varying(8) NOT NULL,
    token text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_devices_check CHECK ((last_seen_at >= registered_at)),
    CONSTRAINT push_devices_platform_check CHECK (((platform)::text = ANY (ARRAY[('android'::character varying)::text, ('ios'::character varying)::text]))),
    CONSTRAINT push_devices_token_check CHECK ((length(btrim(token)) > 0))
);


--
-- Name: recommendation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_messages (
    id uuid NOT NULL,
    message character varying(200) NOT NULL,
    condition_type character varying(20) NOT NULL,
    condition_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    category_id uuid,
    priority smallint DEFAULT 50 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by_admin_id uuid NOT NULL,
    updated_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_messages_check CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at > starts_at))),
    CONSTRAINT recommendation_messages_check1 CHECK (((((condition_type)::text = ANY (ARRAY[('always'::character varying)::text, ('no_mission_today'::character varying)::text, ('streak_at_risk'::character varying)::text])) AND (condition_params = '{}'::jsonb)) OR (((condition_type)::text = 'inactive_days'::text) AND (condition_params ? 'days'::text) AND ((condition_params - 'days'::text) = '{}'::jsonb) AND
CASE
    WHEN ((condition_params ->> 'days'::text) ~ '^[0-9]{1,3}$'::text) THEN ((((condition_params ->> 'days'::text))::integer >= 1) AND (((condition_params ->> 'days'::text))::integer <= 365))
    ELSE false
END) OR (((condition_type)::text = 'time_slot'::text) AND (condition_params ?& ARRAY['start_hour'::text, 'end_hour'::text]) AND (((condition_params - 'start_hour'::text) - 'end_hour'::text) = '{}'::jsonb) AND
CASE
    WHEN (((condition_params ->> 'start_hour'::text) ~ '^[0-9]{1,2}$'::text) AND ((condition_params ->> 'end_hour'::text) ~ '^[0-9]{1,2}$'::text)) THEN ((((condition_params ->> 'start_hour'::text))::integer >= 0) AND (((condition_params ->> 'start_hour'::text))::integer <= 23) AND ((((condition_params ->> 'end_hour'::text))::integer >= 0) AND (((condition_params ->> 'end_hour'::text))::integer <= 23)) AND ((condition_params ->> 'start_hour'::text) <> (condition_params ->> 'end_hour'::text)))
    ELSE false
END))),
    CONSTRAINT recommendation_messages_condition_params_check CHECK ((jsonb_typeof(condition_params) = 'object'::text)),
    CONSTRAINT recommendation_messages_condition_type_check CHECK (((condition_type)::text = ANY (ARRAY[('always'::character varying)::text, ('no_mission_today'::character varying)::text, ('streak_at_risk'::character varying)::text, ('inactive_days'::character varying)::text, ('time_slot'::character varying)::text]))),
    CONSTRAINT recommendation_messages_message_check CHECK ((length(btrim((message)::text)) > 0)),
    CONSTRAINT recommendation_messages_priority_check CHECK (((priority >= 0) AND (priority <= 100)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shop_item_price_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_item_price_versions (
    id uuid NOT NULL,
    item_id uuid NOT NULL,
    version_no integer NOT NULL,
    price_points integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_item_price_versions_price_points_check CHECK ((price_points > 0)),
    CONSTRAINT shop_item_price_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: shop_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_items (
    id uuid NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    item_kind character varying(12) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_items_code_check CHECK (((code)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT shop_items_display_order_check CHECK ((display_order >= 0)),
    CONSTRAINT shop_items_item_kind_check CHECK (((item_kind)::text = ANY (ARRAY[('consumable'::character varying)::text, ('permanent'::character varying)::text]))),
    CONSTRAINT shop_items_name_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: shop_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_orders (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    price_version_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_points integer NOT NULL,
    total_points bigint GENERATED ALWAYS AS (((unit_points)::bigint * quantity)) STORED,
    status character varying(12) DEFAULT 'completed'::character varying NOT NULL,
    spend_transaction_id uuid NOT NULL,
    refund_transaction_id uuid,
    cancel_reason text,
    idempotency_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    CONSTRAINT shop_orders_check CHECK (((((status)::text = 'completed'::text) AND (refund_transaction_id IS NULL) AND (cancelled_at IS NULL) AND (cancel_reason IS NULL)) OR (((status)::text = 'cancelled'::text) AND (refund_transaction_id IS NOT NULL) AND (cancelled_at IS NOT NULL) AND (cancel_reason IS NOT NULL) AND (length(btrim(cancel_reason)) > 0)))),
    CONSTRAINT shop_orders_check1 CHECK ((spend_transaction_id IS DISTINCT FROM refund_transaction_id)),
    CONSTRAINT shop_orders_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT shop_orders_quantity_check CHECK (((quantity >= 1) AND (quantity <= 99))),
    CONSTRAINT shop_orders_status_check CHECK (((status)::text = ANY (ARRAY[('completed'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT shop_orders_unit_points_check CHECK ((unit_points > 0))
);


--
-- Name: streak_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_days (
    user_id uuid NOT NULL,
    streak_date date NOT NULL,
    status character varying(12) NOT NULL,
    qualifying_mission_id uuid,
    qualifying_record_id uuid,
    qualifying_result_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT streak_days_check CHECK (((((status)::text = 'success'::text) AND (qualifying_mission_id IS NOT NULL) AND (qualifying_record_id IS NOT NULL) AND (qualifying_result_id IS NOT NULL)) OR (((status)::text <> 'success'::text) AND (qualifying_mission_id IS NULL) AND (qualifying_record_id IS NULL) AND (qualifying_result_id IS NULL)))),
    CONSTRAINT streak_days_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: streak_milestone_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_milestone_awards (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    target_success_days integer NOT NULL,
    policy_version_id uuid NOT NULL,
    awarded_points integer NOT NULL,
    paid_points integer NOT NULL,
    first_achieved_date date NOT NULL,
    status character varying(12) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT streak_milestone_awards_awarded_points_check CHECK ((awarded_points >= 0)),
    CONSTRAINT streak_milestone_awards_check CHECK ((paid_points <= awarded_points)),
    CONSTRAINT streak_milestone_awards_paid_points_check CHECK ((paid_points >= 0)),
    CONSTRAINT streak_milestone_awards_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text]))),
    CONSTRAINT streak_milestone_awards_target_success_days_check CHECK ((target_success_days = ANY (ARRAY[7, 30, 100])))
);


--
-- Name: streak_milestone_policy_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_milestone_policy_versions (
    id uuid NOT NULL,
    target_success_days integer NOT NULL,
    version_no integer NOT NULL,
    points integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_xp integer DEFAULT 0 NOT NULL,
    pet_xp integer DEFAULT 0 NOT NULL,
    CONSTRAINT streak_milestone_policy_versions_pet_xp_check CHECK ((pet_xp >= 0)),
    CONSTRAINT streak_milestone_policy_versions_points_check CHECK ((points >= 0)),
    CONSTRAINT streak_milestone_policy_versions_target_success_days_check CHECK ((target_success_days = ANY (ARRAY[7, 30, 100]))),
    CONSTRAINT streak_milestone_policy_versions_user_xp_check CHECK ((user_xp >= 0)),
    CONSTRAINT streak_milestone_policy_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: streak_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_states (
    user_id uuid NOT NULL,
    current_success_days integer DEFAULT 0 NOT NULL,
    longest_success_days integer DEFAULT 0 NOT NULL,
    last_success_date date,
    has_pending_days boolean DEFAULT false NOT NULL,
    last_recalculated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT streak_states_check CHECK ((longest_success_days >= current_success_days)),
    CONSTRAINT streak_states_check1 CHECK (((current_success_days = 0) OR (last_success_date IS NOT NULL))),
    CONSTRAINT streak_states_current_success_days_check CHECK ((current_success_days >= 0))
);


--
-- Name: support_ticket_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_events (
    id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    admin_id uuid,
    event_type character varying(20) NOT NULL,
    visibility character varying(10) DEFAULT 'internal'::character varying NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_ticket_events_check CHECK ((((event_type)::text <> ALL (ARRAY[('reply'::character varying)::text, ('note'::character varying)::text])) OR ((body IS NOT NULL) AND (length(btrim(body)) > 0)))),
    CONSTRAINT support_ticket_events_check1 CHECK ((((event_type)::text <> ALL (ARRAY[('reply'::character varying)::text, ('note'::character varying)::text, ('assigned'::character varying)::text])) OR (admin_id IS NOT NULL))),
    CONSTRAINT support_ticket_events_check2 CHECK ((((event_type)::text <> 'note'::text) OR ((visibility)::text = 'internal'::text))),
    CONSTRAINT support_ticket_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('received'::character varying)::text, ('assigned'::character varying)::text, ('status_changed'::character varying)::text, ('reply'::character varying)::text, ('note'::character varying)::text]))),
    CONSTRAINT support_ticket_events_visibility_check CHECK (((visibility)::text = ANY (ARRAY[('user'::character varying)::text, ('internal'::character varying)::text])))
);


--
-- Name: support_ticket_resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_resolutions (
    ticket_id uuid NOT NULL,
    ticket_type character varying(10) NOT NULL,
    outcome character varying(16) NOT NULL,
    user_reply text,
    account_action_id uuid,
    content_action character varying(10),
    resolved_by_admin_id uuid NOT NULL,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_ticket_resolutions_check CHECK ((((ticket_type)::text = 'report'::text) OR ((outcome)::text = 'reply_only'::text))),
    CONSTRAINT support_ticket_resolutions_check1 CHECK ((((outcome)::text <> 'reply_only'::text) OR ((user_reply IS NOT NULL) AND (length(btrim(user_reply)) > 0)))),
    CONSTRAINT support_ticket_resolutions_check2 CHECK (((((outcome)::text = ANY (ARRAY[('no_action'::character varying)::text, ('reply_only'::character varying)::text])) AND (account_action_id IS NULL) AND (content_action IS NULL)) OR (((outcome)::text = 'account_action'::text) AND (content_action IS NULL)) OR (((outcome)::text = 'content_action'::text) AND (account_action_id IS NULL) AND (content_action IS NOT NULL)) OR (((outcome)::text = 'both'::text) AND (content_action IS NOT NULL)))),
    CONSTRAINT support_ticket_resolutions_content_action_check CHECK (((content_action)::text = ANY (ARRAY[('hidden'::character varying)::text, ('deleted'::character varying)::text]))),
    CONSTRAINT support_ticket_resolutions_outcome_check CHECK (((outcome)::text = ANY (ARRAY[('no_action'::character varying)::text, ('reply_only'::character varying)::text, ('account_action'::character varying)::text, ('content_action'::character varying)::text, ('both'::character varying)::text]))),
    CONSTRAINT support_ticket_resolutions_user_reply_check CHECK (((user_reply IS NULL) OR (length(btrim(user_reply)) > 0)))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid NOT NULL,
    ticket_type character varying(10) NOT NULL,
    category character varying(30) NOT NULL,
    reporter_user_id uuid,
    subject character varying(120) NOT NULL,
    body text NOT NULL,
    target_user_id uuid,
    target_mission_definition_id uuid,
    target_challenge_id uuid,
    target_kind character varying(20),
    status character varying(12) DEFAULT 'received'::character varying NOT NULL,
    assigned_admin_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT support_tickets_body_check CHECK ((length(btrim(body)) > 0)),
    CONSTRAINT support_tickets_check CHECK (((((ticket_type)::text = 'inquiry'::text) AND ((category)::text = ANY (ARRAY[('account'::character varying)::text, ('mission'::character varying)::text, ('verification'::character varying)::text, ('points'::character varying)::text, ('challenge'::character varying)::text, ('other'::character varying)::text])) AND (target_kind IS NULL) AND (target_user_id IS NULL) AND (target_mission_definition_id IS NULL) AND (target_challenge_id IS NULL)) OR (((ticket_type)::text = 'report'::text) AND ((category)::text = ANY (ARRAY[('abuse'::character varying)::text, ('inappropriate_content'::character varying)::text, ('cheating'::character varying)::text, ('impersonation'::character varying)::text, ('other'::character varying)::text])) AND (target_kind IS NOT NULL)))),
    CONSTRAINT support_tickets_check1 CHECK (((target_kind IS NULL) OR (((target_kind)::text = 'user'::text) AND (target_mission_definition_id IS NULL) AND (target_challenge_id IS NULL)) OR (((target_kind)::text = 'mission_definition'::text) AND (target_user_id IS NULL) AND (target_challenge_id IS NULL)) OR (((target_kind)::text = 'challenge'::text) AND (target_user_id IS NULL) AND (target_mission_definition_id IS NULL)))),
    CONSTRAINT support_tickets_check2 CHECK (((target_user_id IS NULL) OR (target_user_id IS DISTINCT FROM reporter_user_id))),
    CONSTRAINT support_tickets_check3 CHECK (((((status)::text = 'received'::text) AND (assigned_admin_id IS NULL) AND (completed_at IS NULL)) OR (((status)::text = 'in_review'::text) AND (assigned_admin_id IS NOT NULL) AND (completed_at IS NULL)) OR (((status)::text = 'completed'::text) AND (assigned_admin_id IS NOT NULL) AND (completed_at IS NOT NULL) AND (completed_at >= received_at)))),
    CONSTRAINT support_tickets_status_check CHECK (((status)::text = ANY (ARRAY[('received'::character varying)::text, ('in_review'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT support_tickets_subject_check CHECK ((length(btrim((subject)::text)) > 0)),
    CONSTRAINT support_tickets_target_kind_check CHECK (((target_kind)::text = ANY (ARRAY[('user'::character varying)::text, ('mission_definition'::character varying)::text, ('challenge'::character varying)::text]))),
    CONSTRAINT support_tickets_ticket_type_check CHECK (((ticket_type)::text = ANY (ARRAY[('inquiry'::character varying)::text, ('report'::character varying)::text])))
);


--
-- Name: user_achievement_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievement_events (
    id uuid NOT NULL,
    user_achievement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type character varying(16) NOT NULL,
    source_type character varying(12) NOT NULL,
    source_id uuid NOT NULL,
    reason text,
    idempotency_key text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_achievement_events_check CHECK ((((event_type)::text <> 'revoked'::text) OR ((reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT user_achievement_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('earned'::character varying)::text, ('revoked'::character varying)::text, ('reinstated'::character varying)::text]))),
    CONSTRAINT user_achievement_events_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT user_achievement_events_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('goal'::character varying)::text, ('mission'::character varying)::text, ('streak'::character varying)::text, ('challenge'::character varying)::text])))
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    achievement_version_id uuid NOT NULL,
    badge_image_id uuid NOT NULL,
    status character varying(12) DEFAULT 'active'::character varying NOT NULL,
    source_type character varying(12) NOT NULL,
    source_id uuid NOT NULL,
    first_achieved_at timestamp with time zone NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    awarded_points integer NOT NULL,
    paid_points integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_achievements_awarded_points_check CHECK ((awarded_points >= 0)),
    CONSTRAINT user_achievements_check CHECK ((first_achieved_at <= awarded_at)),
    CONSTRAINT user_achievements_check1 CHECK ((paid_points <= awarded_points)),
    CONSTRAINT user_achievements_paid_points_check CHECK ((paid_points >= 0)),
    CONSTRAINT user_achievements_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('goal'::character varying)::text, ('mission'::character varying)::text, ('streak'::character varying)::text, ('challenge'::character varying)::text]))),
    CONSTRAINT user_achievements_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text])))
);


--
-- Name: user_experience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_experience (
    user_id uuid NOT NULL,
    level_policy_version_id uuid NOT NULL,
    total_xp bigint DEFAULT 0 NOT NULL,
    level_no integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_experience_level_no_check CHECK ((level_no > 0)),
    CONSTRAINT user_experience_total_xp_check CHECK ((total_xp >= 0))
);


--
-- Name: user_idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_idempotency_keys (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    operation character varying(80) NOT NULL,
    request_hash text NOT NULL,
    status character varying(12) DEFAULT 'in_progress'::character varying NOT NULL,
    response_status smallint,
    response_body jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT user_idempotency_keys_check CHECK (((((status)::text = 'in_progress'::text) AND (completed_at IS NULL) AND (response_status IS NULL)) OR (((status)::text <> 'in_progress'::text) AND (completed_at IS NOT NULL) AND (completed_at >= created_at)))),
    CONSTRAINT user_idempotency_keys_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT user_idempotency_keys_operation_check CHECK ((length(btrim((operation)::text)) > 0)),
    CONSTRAINT user_idempotency_keys_request_hash_check CHECK ((length(request_hash) > 0)),
    CONSTRAINT user_idempotency_keys_response_status_check CHECK (((response_status >= 100) AND (response_status <= 599))),
    CONSTRAINT user_idempotency_keys_status_check CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identities (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    provider_subject text NOT NULL,
    email character varying(255),
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_identities_provider_check CHECK (((provider)::text = ANY (ARRAY[('apple'::character varying)::text, ('google'::character varying)::text, ('naver'::character varying)::text]))),
    CONSTRAINT user_identities_provider_subject_check CHECK ((length(provider_subject) > 0))
);


--
-- Name: user_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_inventory (
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_inventory_quantity_check CHECK ((quantity >= 0))
);


--
-- Name: user_inventory_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_inventory_events (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    kind character varying(12) NOT NULL,
    quantity_delta integer NOT NULL,
    order_id uuid,
    idempotency_key text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_inventory_events_check CHECK (((((kind)::text = 'purchase'::text) AND (quantity_delta > 0) AND (order_id IS NOT NULL)) OR (((kind)::text = 'refund'::text) AND (quantity_delta < 0) AND (order_id IS NOT NULL)) OR (((kind)::text = 'use'::text) AND (quantity_delta < 0)))),
    CONSTRAINT user_inventory_events_idempotency_key_check CHECK ((length(btrim(idempotency_key)) > 0)),
    CONSTRAINT user_inventory_events_kind_check CHECK (((kind)::text = ANY (ARRAY[('purchase'::character varying)::text, ('refund'::character varying)::text, ('use'::character varying)::text]))),
    CONSTRAINT user_inventory_events_quantity_delta_check CHECK ((quantity_delta <> 0))
);


--
-- Name: user_level_policy_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_level_policy_versions (
    id uuid NOT NULL,
    version_no integer NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_level_policy_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: user_level_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_level_thresholds (
    policy_version_id uuid NOT NULL,
    level_no integer NOT NULL,
    min_total_xp bigint NOT NULL,
    CONSTRAINT user_level_thresholds_check CHECK (((level_no <> 1) OR (min_total_xp = 0))),
    CONSTRAINT user_level_thresholds_level_no_check CHECK ((level_no > 0)),
    CONSTRAINT user_level_thresholds_min_total_xp_check CHECK ((min_total_xp >= 0))
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(8) NOT NULL,
    notice_id uuid,
    event_key text,
    title character varying(120) NOT NULL,
    body text NOT NULL,
    link_screen character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    push_status character varying(8) DEFAULT 'none'::character varying NOT NULL,
    push_sent_at timestamp with time zone,
    push_attempts integer DEFAULT 0 NOT NULL,
    push_last_error text,
    CONSTRAINT user_notifications_body_check CHECK ((length(btrim(body)) > 0)),
    CONSTRAINT user_notifications_check CHECK (((((kind)::text = 'notice'::text) AND (notice_id IS NOT NULL) AND (event_key IS NULL)) OR (((kind)::text = 'system'::text) AND (notice_id IS NULL) AND (event_key IS NOT NULL)))),
    CONSTRAINT user_notifications_check1 CHECK ((((push_status)::text = 'sent'::text) = (push_sent_at IS NOT NULL))),
    CONSTRAINT user_notifications_check2 CHECK (((read_at IS NULL) OR (read_at >= created_at))),
    CONSTRAINT user_notifications_event_key_check CHECK (((event_key IS NULL) OR (length(btrim(event_key)) > 0))),
    CONSTRAINT user_notifications_kind_check CHECK (((kind)::text = ANY (ARRAY[('notice'::character varying)::text, ('system'::character varying)::text]))),
    CONSTRAINT user_notifications_link_screen_check CHECK (((link_screen)::text ~ '^[a-z][a-z0-9_/.-]*$'::text)),
    CONSTRAINT user_notifications_push_attempts_check CHECK ((push_attempts >= 0)),
    CONSTRAINT user_notifications_push_status_check CHECK (((push_status)::text = ANY (ARRAY[('none'::character varying)::text, ('pending'::character varying)::text, ('sent'::character varying)::text, ('failed'::character varying)::text, ('skipped'::character varying)::text]))),
    CONSTRAINT user_notifications_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: user_pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    species_id uuid NOT NULL,
    species_version_id uuid NOT NULL,
    level_policy_version_id uuid NOT NULL,
    nickname character varying(10) NOT NULL,
    total_xp bigint DEFAULT 0 NOT NULL,
    level_no integer DEFAULT 1 NOT NULL,
    stage_no smallint DEFAULT 1 NOT NULL,
    selected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_pets_level_no_check CHECK ((level_no > 0)),
    CONSTRAINT user_pets_nickname_check CHECK (((nickname)::text ~ '^[가-힣A-Za-z]{2,10}$'::text)),
    CONSTRAINT user_pets_stage_no_check CHECK (((stage_no >= 1) AND (stage_no <= 3))),
    CONSTRAINT user_pets_total_xp_check CHECK ((total_xp >= 0))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    status character varying(24) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('withdrawal_processing'::character varying)::text])))
);


--
-- Name: verification_appeals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_appeals (
    id uuid NOT NULL,
    record_id uuid NOT NULL,
    filed_by_user_id uuid NOT NULL,
    original_result_id uuid NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    filed_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by_admin_id uuid,
    resolution_result_id uuid,
    resolved_at timestamp with time zone,
    CONSTRAINT verification_appeals_check CHECK (((((status)::text = 'open'::text) AND (reviewed_by_admin_id IS NULL) AND (resolution_result_id IS NULL) AND (resolved_at IS NULL)) OR (((status)::text <> 'open'::text) AND (reviewed_by_admin_id IS NOT NULL) AND (resolution_result_id IS NOT NULL) AND (resolved_at IS NOT NULL)))),
    CONSTRAINT verification_appeals_check1 CHECK (((resolved_at IS NULL) OR (resolved_at >= filed_at))),
    CONSTRAINT verification_appeals_reason_check CHECK ((length(btrim(reason)) > 0)),
    CONSTRAINT verification_appeals_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text])))
);


--
-- Name: verification_criteria_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_criteria_versions (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    verification_method character varying(30) NOT NULL,
    version_no integer NOT NULL,
    rules_json jsonb NOT NULL,
    effective_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verification_criteria_versions_rules_json_check CHECK ((jsonb_typeof(rules_json) = 'object'::text)),
    CONSTRAINT verification_criteria_versions_verification_method_check CHECK (((verification_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('sensor'::character varying)::text]))),
    CONSTRAINT verification_criteria_versions_version_no_check CHECK ((version_no > 0))
);


--
-- Name: verification_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_results (
    id uuid NOT NULL,
    record_id uuid NOT NULL,
    result_no integer NOT NULL,
    source character varying(20) NOT NULL,
    decision character varying(20) NOT NULL,
    criteria_version_id uuid NOT NULL,
    engine_version character varying(80),
    confidence numeric(5,4),
    metrics jsonb,
    reason text,
    reviewed_by_admin_id uuid,
    is_current boolean DEFAULT true NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    ingest_key text,
    raw_result jsonb,
    CONSTRAINT verification_results_check CHECK (((((source)::text = 'ai'::text) AND (reviewed_by_admin_id IS NULL) AND (engine_version IS NOT NULL) AND (length(btrim((engine_version)::text)) > 0)) OR (((source)::text = 'admin'::text) AND (reviewed_by_admin_id IS NOT NULL)))),
    CONSTRAINT verification_results_check1 CHECK ((((decision)::text <> 'review_required'::text) OR (((source)::text = 'ai'::text) AND (notified_at IS NULL)))),
    CONSTRAINT verification_results_check2 CHECK ((((source)::text <> 'admin'::text) OR ((reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT verification_results_check3 CHECK (((notified_at IS NULL) OR (notified_at >= decided_at))),
    CONSTRAINT verification_results_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT verification_results_decision_check CHECK (((decision)::text = ANY (ARRAY[('approved'::character varying)::text, ('rejected'::character varying)::text, ('review_required'::character varying)::text]))),
    CONSTRAINT verification_results_ingest_key_ai_only CHECK (((ingest_key IS NULL) OR ((source)::text = 'ai'::text))),
    CONSTRAINT verification_results_ingest_key_check CHECK (((ingest_key IS NULL) OR (length(btrim(ingest_key)) > 0))),
    CONSTRAINT verification_results_metrics_check CHECK (((metrics IS NULL) OR (jsonb_typeof(metrics) = 'object'::text))),
    CONSTRAINT verification_results_raw_result_check CHECK (((raw_result IS NULL) OR (jsonb_typeof(raw_result) = 'object'::text))),
    CONSTRAINT verification_results_result_no_check CHECK ((result_no > 0)),
    CONSTRAINT verification_results_source_check CHECK (((source)::text = ANY (ARRAY[('ai'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: weather_grid_cells; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_grid_cells (
    nx smallint NOT NULL,
    ny smallint NOT NULL,
    first_requested_at timestamp with time zone DEFAULT now() NOT NULL,
    last_requested_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weather_grid_cells_check CHECK ((last_requested_at >= first_requested_at)),
    CONSTRAINT weather_grid_cells_nx_check CHECK (((nx >= 1) AND (nx <= 149))),
    CONSTRAINT weather_grid_cells_ny_check CHECK (((ny >= 1) AND (ny <= 253)))
);


--
-- Name: weather_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_observations (
    nx smallint NOT NULL,
    ny smallint NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    weather character varying(16) NOT NULL,
    temperature_c smallint NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weather_observations_observed_at_check CHECK ((observed_at = date_trunc('hour'::text, observed_at))),
    CONSTRAINT weather_observations_temperature_c_check CHECK (((temperature_c >= '-80'::integer) AND (temperature_c <= 60))),
    CONSTRAINT weather_observations_weather_check CHECK (((weather)::text = ANY (ARRAY[('clear'::character varying)::text, ('clouds'::character varying)::text, ('rain'::character varying)::text, ('snow'::character varying)::text])))
);


--
-- Data for Name: account_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at, lifted_at, created_at, source_ticket_id) FROM stdin;
efc66460-22d3-4cfe-953a-e55eb6aed311	389e1d24-ebcf-4081-898b-e9489d21d682	d0000000-0000-4000-8000-000000000001	warning	시연: 부적절한 닉네임 경고	2026-11-13 01:32:16.635221+09	\N	\N	2026-11-13 01:32:16.635221+09	\N
6e700b49-8629-460d-9fe8-f37ea492b8f3	389e1d24-ebcf-4081-898b-e9489d21d682	d0000000-0000-4000-8000-000000000001	restriction	시연: 반복 신고로 7일 이용 제한	2026-11-13 01:32:16.660418+09	2026-11-20 01:32:16.660418+09	\N	2026-11-13 01:32:16.660418+09	\N
\.


--
-- Data for Name: account_withdrawal_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_withdrawal_requests (id, user_id, status, requested_at, reviewed_by, reviewed_at, reason, completed_at) FROM stdin;
679ead6a-1e90-4c05-812e-7fc12907d57c	91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	on_hold	2026-11-13 01:32:16.820752+09	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.842213+09	시연: 환불 문의 확인 중이라 보류	\N
\.


--
-- Data for Name: achievement_backfill_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievement_backfill_runs (id, achievement_id, version_id, requested_by_admin_id, cursor_user_id, processed_users, earned_count, requested_at, completed_at) FROM stdin;
aa833c2b-10c3-445d-b0f5-7b0896fdd100	49a29d6f-3bbd-49d1-b3d2-d856d7b59c62	db082b71-a706-40fe-9e4d-320d0d33bdfa	d0000000-0000-4000-8000-000000000001	\N	0	0	2026-11-13 01:32:16.995705+09	\N
\.


--
-- Data for Name: achievement_badge_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievement_badge_images (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id, created_at) FROM stdin;
d0000000-0000-4000-8000-000000000211	d0000000-0000-4000-8000-000000000201	1	dev/assets/badges/d0000000-0000-4000-8000-000000000201/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000212	d0000000-0000-4000-8000-000000000202	1	dev/assets/badges/d0000000-0000-4000-8000-000000000202/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000213	d0000000-0000-4000-8000-000000000203	1	dev/assets/badges/d0000000-0000-4000-8000-000000000203/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000214	d0000000-0000-4000-8000-000000000204	1	dev/assets/badges/d0000000-0000-4000-8000-000000000204/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000215	d0000000-0000-4000-8000-000000000205	1	dev/assets/badges/d0000000-0000-4000-8000-000000000205/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000216	d0000000-0000-4000-8000-000000000206	1	dev/assets/badges/d0000000-0000-4000-8000-000000000206/v1.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
463fa2ac-30bf-4b7e-8bae-4d8cd3750bb0	49a29d6f-3bbd-49d1-b3d2-d856d7b59c62	1	dev/assets/badges/49a29d6f-3bbd-49d1-b3d2-d856d7b59c62/v1.png	image/png	2048	2026-11-13 01:32:16.976+09	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.995705+09
\.


--
-- Data for Name: achievement_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievement_definitions (id, code, status, created_by_admin_id, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000201	first_goal	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000202	missions_10	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000203	missions_50	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000204	exercise_20	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000205	streak_7	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000206	challenge_1	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
49a29d6f-3bbd-49d1-b3d2-d856d7b59c62	demo_ten_missions	public	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.995705+09	2026-11-13 01:32:16.995705+09
\.


--
-- Data for Name: achievement_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievement_versions (id, achievement_id, version_no, title, description, rarity, condition_type, target_count, category_id, reward_points, badge_image_id, effective_at, created_by_admin_id, created_at, reward_user_xp, reward_pet_xp) FROM stdin;
d0000000-0000-4000-8000-000000000221	d0000000-0000-4000-8000-000000000201	1	첫 목표 달성	목표를 처음으로 완료했어요	common	first_goal_completed	1	\N	100	d0000000-0000-4000-8000-000000000211	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	100	0
d0000000-0000-4000-8000-000000000222	d0000000-0000-4000-8000-000000000202	1	미션 10개	미션을 10개 완료했어요	common	approved_mission_count	10	\N	100	d0000000-0000-4000-8000-000000000212	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	100	0
d0000000-0000-4000-8000-000000000223	d0000000-0000-4000-8000-000000000203	1	미션 50개	미션을 50개 완료했어요	rare	approved_mission_count	50	\N	300	d0000000-0000-4000-8000-000000000213	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	300	0
d0000000-0000-4000-8000-000000000224	d0000000-0000-4000-8000-000000000204	1	운동 20회	운동 미션을 20개 완료했어요	rare	category_approved_mission_count	20	d0000000-0000-4000-8000-000000000011	200	d0000000-0000-4000-8000-000000000214	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	200	0
d0000000-0000-4000-8000-000000000225	d0000000-0000-4000-8000-000000000205	1	7일 연속	7일 연속으로 미션을 해냈어요	rare	streak_milestone	7	\N	0	d0000000-0000-4000-8000-000000000215	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	0	0
d0000000-0000-4000-8000-000000000226	d0000000-0000-4000-8000-000000000206	1	첫 챌린지 완주	챌린지를 처음으로 완주했어요	legendary	challenge_completed	1	\N	0	d0000000-0000-4000-8000-000000000216	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	0	0
db082b71-a706-40fe-9e4d-320d0d33bdfa	49a29d6f-3bbd-49d1-b3d2-d856d7b59c62	1	열 번의 걸음	미션 인증을 10번 승인받았어요	rare	approved_mission_count	10	\N	100	463fa2ac-30bf-4b7e-8bae-4d8cd3750bb0	2026-11-13 01:32:16.985+09	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.995705+09	50	30
\.


--
-- Data for Name: admin_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_accounts (id, login_id, email, password_hash, status, failed_attempt_count, locked_until, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000001	dev_admin	dev-admin@example.test	$argon2id$v=19$m=65536,p=4,t=3$Q4LCSoNBteuP6xs8fXighQ$NzpvPK+hCR+oEaxY74Ju9wKx9mE3rqhGvnWWCpACxEE	active	1	\N	2026-11-09 20:23:23.066855+09	2026-11-12 22:35:47.371194+09
\.


--
-- Data for Name: admin_asset_uploads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_asset_uploads (id, asset_kind, owner_id, version_no, object_key, mime_type, size_bytes, created_by_admin_id, created_at, uploaded_at, consumed_at) FROM stdin;
463fa2ac-30bf-4b7e-8bae-4d8cd3750bb0	badge	49a29d6f-3bbd-49d1-b3d2-d856d7b59c62	1	dev/assets/badges/49a29d6f-3bbd-49d1-b3d2-d856d7b59c62/v1.png	image/png	2048	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.95887+09	2026-11-13 01:32:16.976575+09	2026-11-13 01:32:16.995705+09
\.


--
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_audit_logs (id, admin_id, target_user_id, action, result, reason, before_value, after_value, recorded_at) FROM stdin;
f98b56df-f2f7-460d-91e0-0a5bfed536a9	d0000000-0000-4000-8000-000000000001	\N	challenge.create	success	시연 챌린지 등록	\N	{"id": "0393db21-215c-4286-b2ed-f3ee5919240c", "phase": "recruiting", "title": "7일 스쿼트 챌린지(시연)", "joined": false, "origin": "admin", "reward": {"petXp": 50, "points": 500, "userXp": 100, "badgeAchievementVersionId": null}, "endDate": "2026-11-20", "capacity": null, "startDate": "2026-11-14", "categoryId": "d0000000-0000-4000-8000-000000000011", "periodDays": 7, "targetUnit": "reps", "cancelledAt": null, "description": "7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주", "publishedAt": null, "targetValue": 20, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "exerciseCode": "squat", "rewardPoints": 500, "creatorNickname": null, "maxParticipants": null, "participantCount": 0, "settlementStatus": "not_started", "publicationStatus": "draft", "verificationMethod": "camera", "requiredSuccessDays": 6, "completionRateRequired": 0.8571, "estimatedDurationSeconds": 180}	2026-11-12 22:16:00.299844+09
d2226b7a-8f5f-4ba6-acbd-efe1ba8e2691	d0000000-0000-4000-8000-000000000001	\N	challenge.update	success	시연 챌린지 공개	\N	{"id": "0393db21-215c-4286-b2ed-f3ee5919240c", "phase": "recruiting", "title": "7일 스쿼트 챌린지(시연)", "joined": false, "origin": "admin", "reward": {"petXp": 50, "points": 500, "userXp": 100, "badgeAchievementVersionId": null}, "endDate": "2026-11-20", "capacity": null, "startDate": "2026-11-14", "categoryId": "d0000000-0000-4000-8000-000000000011", "periodDays": 7, "targetUnit": "reps", "cancelledAt": null, "description": "7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주", "publishedAt": "2026-11-12T13:16:00.471Z", "targetValue": 20, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "exerciseCode": "squat", "rewardPoints": 500, "creatorNickname": null, "maxParticipants": null, "participantCount": 0, "settlementStatus": "not_started", "publicationStatus": "public", "verificationMethod": "camera", "requiredSuccessDays": 6, "completionRateRequired": 0.8571, "estimatedDurationSeconds": 180}	2026-11-12 22:16:00.471508+09
e1087161-3336-4511-b8d7-156d88315fca	d0000000-0000-4000-8000-000000000001	\N	notice.create	success	시연 공지 등록	\N	{"id": "9ccf005a-fc4d-47ba-b4f8-f3c7319600e6", "title": "시연 공지: D-World에 오신 걸 환영해요", "status": "draft"}	2026-11-12 22:16:00.907382+09
01dd4664-a909-4656-929f-73d68695ad34	d0000000-0000-4000-8000-000000000001	\N	notice.publish	success	시연 공지 게시	{"status": "draft"}	{"status": "published", "scheduledAt": null}	2026-11-12 22:16:01.03664+09
b0824558-f35c-4b0e-a0df-b0a7994ffa10	d0000000-0000-4000-8000-000000000001	\N	admin.login	failure	\N	\N	\N	2026-11-12 22:35:47.371194+09
09f81be5-c7be-47bf-bccf-9e46f7e246b8	d0000000-0000-4000-8000-000000000001	\N	ticket.resolve	success	시연 문의 답변	{"status": "received"}	{"status": "completed", "outcome": "reply_only"}	2026-11-13 01:32:16.412811+09
cad120d8-fbd0-4dc7-b19f-8334ddcf01e8	d0000000-0000-4000-8000-000000000001	389e1d24-ebcf-4081-898b-e9489d21d682	account_action.create	success	시연: 부적절한 닉네임 경고	\N	{"id": "efc66460-22d3-4cfe-953a-e55eb6aed311", "endsAt": null, "reason": "시연: 부적절한 닉네임 경고", "userId": "389e1d24-ebcf-4081-898b-e9489d21d682", "adminId": "d0000000-0000-4000-8000-000000000001", "liftedAt": null, "startsAt": "2026-11-12T16:32:16.635Z", "createdAt": "2026-11-12T16:32:16.635Z", "actionType": "warning", "sourceTicketId": null}	2026-11-13 01:32:16.635221+09
3d99b2ab-1455-405c-9f7d-b791e0ecc782	d0000000-0000-4000-8000-000000000001	389e1d24-ebcf-4081-898b-e9489d21d682	account_action.create	success	시연: 반복 신고로 7일 이용 제한	\N	{"id": "6e700b49-8629-460d-9fe8-f37ea492b8f3", "endsAt": "2026-11-19T16:32:16.660Z", "reason": "시연: 반복 신고로 7일 이용 제한", "userId": "389e1d24-ebcf-4081-898b-e9489d21d682", "adminId": "d0000000-0000-4000-8000-000000000001", "liftedAt": null, "startsAt": "2026-11-12T16:32:16.660Z", "createdAt": "2026-11-12T16:32:16.660Z", "actionType": "restriction", "sourceTicketId": null}	2026-11-13 01:32:16.660418+09
1fe07557-1e2e-4404-8d68-8d6bed4015db	d0000000-0000-4000-8000-000000000001	91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	withdrawal.update	success	시연: 환불 문의 확인 중이라 보류	{"status": "requested"}	{"status": "on_hold"}	2026-11-13 01:32:16.842213+09
89ab2cff-5624-4bc8-9983-f7d37d3eb32d	d0000000-0000-4000-8000-000000000001	3a1a615d-da53-4098-b81c-168537d9c5e7	mission_definition.review	success	시연: 내용이 명확해 공개 승인	{"publicationStatus": "review_pending"}	{"publicationStatus": "public"}	2026-11-13 01:32:16.939038+09
d38f58a6-1a63-4ded-8f78-85ff1fe27cd3	d0000000-0000-4000-8000-000000000001	\N	asset.upload	success	시연 배지 이미지 업로드	\N	{"assetId": "463fa2ac-30bf-4b7e-8bae-4d8cd3750bb0", "ownerId": "49a29d6f-3bbd-49d1-b3d2-d856d7b59c62", "assetKind": "badge"}	2026-11-13 01:32:16.95887+09
4c712a3d-7a55-408c-b44f-ff9a2b150229	d0000000-0000-4000-8000-000000000001	\N	achievement.create	success	시연 업적 공개	\N	{"id": "49a29d6f-3bbd-49d1-b3d2-d856d7b59c62", "code": "demo_ten_missions", "status": "public", "versionNo": 1}	2026-11-13 01:32:16.995705+09
5aac3889-ba13-42d0-a9c4-820ca345bfcc	d0000000-0000-4000-8000-000000000001	ad2ee538-8b45-4a7d-af16-84eba6f995e4	challenge.review	success	공개해도 좋은 챌린지예요.	{"status": "review_pending"}	{"status": "public", "decision": "approve"}	2026-11-13 01:32:17.27858+09
b1033ddb-6626-4792-a77e-d090d0327d2a	d0000000-0000-4000-8000-000000000001	ad2ee538-8b45-4a7d-af16-84eba6f995e4	challenge.review	success	목표가 구체적이지 않아 반려해요.	{"status": "review_pending"}	{"status": "rejected", "decision": "reject"}	2026-11-13 01:32:17.333609+09
e289a8df-87e3-4ed9-ac9b-e3bb3a7fa7fa	d0000000-0000-4000-8000-000000000001	\N	challenge.create	success	시연 정산용 공식 챌린지	\N	{"id": "231d3c59-ac93-4c12-bb2d-fef9c17b6972", "phase": "recruiting", "title": "시연 정산 챌린지", "joined": false, "origin": "admin", "reward": {"petXp": 60, "points": 300, "userXp": 30, "badgeAchievementVersionId": null}, "endDate": "2026-11-21", "capacity": null, "startDate": "2026-11-15", "categoryId": "d0000000-0000-4000-8000-000000000011", "periodDays": 7, "targetUnit": null, "cancelledAt": null, "description": "시연용 챌린지예요.", "publishedAt": null, "targetValue": null, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "exerciseCode": "running", "rewardPoints": 300, "creatorNickname": null, "maxParticipants": null, "participantCount": 0, "settlementStatus": "not_started", "publicationStatus": "draft", "verificationMethod": "sensor", "requiredSuccessDays": 2, "completionRateRequired": 0.2857, "estimatedDurationSeconds": null}	2026-11-13 01:32:17.364694+09
b6444a8c-86ac-4a5f-9dd6-064695a31d1b	d0000000-0000-4000-8000-000000000001	\N	challenge.update	success	시연 공개	\N	{"id": "231d3c59-ac93-4c12-bb2d-fef9c17b6972", "phase": "recruiting", "title": "시연 정산 챌린지", "joined": false, "origin": "admin", "reward": {"petXp": 60, "points": 300, "userXp": 30, "badgeAchievementVersionId": null}, "endDate": "2026-11-21", "capacity": null, "startDate": "2026-11-15", "categoryId": "d0000000-0000-4000-8000-000000000011", "periodDays": 7, "targetUnit": null, "cancelledAt": null, "description": "시연용 챌린지예요.", "publishedAt": "2026-11-12T16:32:17.386Z", "targetValue": null, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "exerciseCode": "running", "rewardPoints": 300, "creatorNickname": null, "maxParticipants": null, "participantCount": 0, "settlementStatus": "not_started", "publicationStatus": "public", "verificationMethod": "sensor", "requiredSuccessDays": 2, "completionRateRequired": 0.2857, "estimatedDurationSeconds": null}	2026-11-13 01:32:17.386055+09
3aaa6cb9-69e8-4f64-8016-bf48ef7e333e	d0000000-0000-4000-8000-000000000001	a45a1748-0674-4ebe-9b85-c0496143c495	challenge.moderate	success	시연: 부정 행위 의심	{"status": "enrolled"}	{"status": "disqualified", "participationId": "47f60e97-2d6c-48c2-b9ae-05a15e2a95cb"}	2026-11-13 01:32:18.811299+09
e7005f7a-5f3c-4bf0-b92a-5034699f1b32	d0000000-0000-4000-8000-000000000001	\N	settlement.create	success	시연 정산 초안	\N	{"id": "1abff01d-99d8-45b9-8bfd-e599db301f74", "runNo": 1, "reason": null, "status": "draft", "entries": [{"rank": 1, "petXp": 60, "score": 300, "userXp": 30, "outcome": "completed", "paidPoints": 0, "paymentStatus": "pending", "promisedPoints": 300, "successfulDays": 3, "exclusionReason": null, "participationId": "be896788-9708-42ea-b3aa-15409399cd4e", "lastQualifyingSubmittedAt": "2026-11-07T16:32:18.881Z"}, {"rank": 2, "petXp": 60, "score": 200, "userXp": 30, "outcome": "completed", "paidPoints": 0, "paymentStatus": "pending", "promisedPoints": 300, "successfulDays": 2, "exclusionReason": null, "participationId": "ee4605d4-1589-48e7-8596-64be63f25566", "lastQualifyingSubmittedAt": "2026-11-06T16:32:18.738Z"}, {"rank": 3, "petXp": 0, "score": 100, "userXp": 0, "outcome": "failed", "paidPoints": 0, "paymentStatus": "none", "promisedPoints": 0, "successfulDays": 1, "exclusionReason": null, "participationId": "f96e81b3-a638-441b-ab68-c4ba8eb44b35", "lastQualifyingSubmittedAt": "2026-11-05T16:32:18.455Z"}, {"rank": null, "petXp": 0, "score": 100, "userXp": 0, "outcome": "disqualified", "paidPoints": 0, "paymentStatus": "none", "promisedPoints": 0, "successfulDays": 1, "exclusionReason": "시연: 부정 행위 의심", "participationId": "47f60e97-2d6c-48c2-b9ae-05a15e2a95cb", "lastQualifyingSubmittedAt": "2026-11-05T16:32:18.534Z"}, {"rank": null, "petXp": 0, "score": 0, "userXp": 0, "outcome": "withdrawn", "paidPoints": 0, "paymentStatus": "none", "promisedPoints": 0, "successfulDays": 0, "exclusionReason": "자진 포기", "participationId": "a54c7244-9905-41de-8110-66bcb63b91aa", "lastQualifyingSubmittedAt": null}], "blockers": {"ready": true, "notEnded": false, "pendingDays": 0, "waitingSubmissions": 0, "incompleteParticipants": 0}, "basedOnAt": "2026-11-12T16:32:18.989Z", "challengeId": "231d3c59-ac93-4c12-bb2d-fef9c17b6972", "confirmedAt": null}	2026-11-13 01:32:18.989429+09
5dca8527-2cf9-4889-ac30-cd9454c686e8	d0000000-0000-4000-8000-000000000001	\N	settlement.confirm	success	시연 정산 확정	\N	{"runId": "1abff01d-99d8-45b9-8bfd-e599db301f74", "runNo": 1, "status": "confirmed", "entries": 5, "completed": 2, "finalRankings": 3, "revokedGrants": 0}	2026-11-13 01:32:19.020061+09
c15da6cf-0bed-46f6-8e72-6bec4466db08	d0000000-0000-4000-8000-000000000001	b60ef6c5-f266-49ad-b850-21bd49a3916d	point.adjust	success	시연: 잔액 일부 회수	\N	{"id": "d4053835-d042-4195-a0ee-d772a6fc70b4", "kind": "manual_recovery", "reason": "시연: 잔액 일부 회수", "userId": "b60ef6c5-f266-49ad-b850-21bd49a3916d", "sourceId": "596d0ee3-69f3-4486-9257-326961da5a88", "occurredAt": "2026-11-12T16:32:20.606Z", "sourceType": "admin_adjustment", "balanceAfter": 6, "availableDelta": -14, "createdByAdminId": "d0000000-0000-4000-8000-000000000001", "outstandingAfter": 0, "outstandingDelta": 0}	2026-11-13 01:32:20.606218+09
8e24aab0-dac8-4232-ab35-8f7cdb238aad	d0000000-0000-4000-8000-000000000001	\N	criteria.create	success	시연: 러닝 최소 5분·300m	\N	{"id": "ef457f19-ceae-44d4-a0af-c940bd3cf8a9", "rules": {"minDistanceMeters": 300, "minDurationSeconds": 300}, "versionNo": 2, "categoryId": "d0000000-0000-4000-8000-000000000011", "effectiveAt": "2026-11-13T01:46:06.818Z", "verificationMethod": "sensor"}	2026-11-13 10:46:06.818021+09
\.


--
-- Data for Name: ai_analysis_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_analysis_runs (id, user_id, run_type, period_start, period_end, status, engine_version, ingest_key, failure_reason, requested_at, completed_at, generation_no, superseded_at) FROM stdin;
4ac825f0-7903-40d2-9b13-ff8ac1a028ab	3a1a615d-da53-4098-b81c-168537d9c5e7	situational_recommendation	\N	\N	completed	rule-rec@0.1.0	\N	\N	2026-11-12 16:50:09.448254+09	2026-11-12 16:50:09.448254+09	1	\N
57bee07e-445e-4a98-8049-a2505ac55bd0	3a1a615d-da53-4098-b81c-168537d9c5e7	situational_recommendation	\N	\N	completed	rule-rec@0.1.0	\N	\N	2026-11-12 22:16:01.395465+09	2026-11-12 22:16:01.395465+09	1	\N
8334e6ba-260c-45d3-a7a2-6a9fea596eef	3a1a615d-da53-4098-b81c-168537d9c5e7	weekly_report	2026-11-02	2026-11-08	completed	demo@1	\N	\N	2026-11-12 22:16:01.508282+09	2026-11-12 22:16:01.508282+09	1	\N
182b3268-6372-4b67-8362-0649c245ef87	3a1a615d-da53-4098-b81c-168537d9c5e7	situational_recommendation	\N	\N	completed	rule-rec@0.1.0	\N	\N	2026-11-12 23:07:26.597231+09	2026-11-12 23:07:26.597231+09	1	\N
9efa5c23-17ec-4c88-a560-b654aea55a97	3a1a615d-da53-4098-b81c-168537d9c5e7	plan_adjustment	2026-11-02	2026-11-08	completed	demo-adjust@1	plan-adjust:9efa5c23-17ec-4c88-a560-b654aea55a97:ced49867-b656-4b4f-a745-aa195b6ac979	\N	2026-11-13 01:32:17.052084+09	2026-11-13 01:32:17.065433+09	1	\N
\.


--
-- Data for Name: ai_mission_recommendations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_mission_recommendations (id, run_id, run_type, user_id, rank_no, mission_definition_id, suggestion_text, reason, context, status, created_at, expires_at, decided_at, mission_id) FROM stdin;
604c99ba-63e5-4e2d-9089-b1384778531b	4ac825f0-7903-40d2-9b13-ff8ac1a028ab	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	1	d0000000-0000-4000-8000-000000000306	\N	날씨가 좋아서 밖에서 달리기 좋아요.	{"weather": "clear", "isMoving": false, "timeSlot": "afternoon", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 16:50:09.448254+09	2026-11-12 19:50:09.448254+09	\N	\N
c83b3d51-d442-4b6d-9d99-bb0f9a101646	4ac825f0-7903-40d2-9b13-ff8ac1a028ab	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	2	d0000000-0000-4000-8000-000000000305	\N	진행 중인 목표와 잘 맞아요.	{"weather": "clear", "isMoving": false, "timeSlot": "afternoon", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 16:50:09.448254+09	2026-11-12 19:50:09.448254+09	\N	\N
601a5499-1e04-4b63-88dc-8fd7d31f1211	4ac825f0-7903-40d2-9b13-ff8ac1a028ab	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	3	d0000000-0000-4000-8000-000000000304	\N	진행 중인 목표와 잘 맞아요.	{"weather": "clear", "isMoving": false, "timeSlot": "afternoon", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 16:50:09.448254+09	2026-11-12 19:50:09.448254+09	\N	\N
6e590779-1e47-4606-9599-88d0dc9fbc29	57bee07e-445e-4a98-8049-a2505ac55bd0	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	1	d0000000-0000-4000-8000-000000000306	\N	날씨가 좋아서 밖에서 달리기 좋아요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 22:16:01.395465+09	2026-11-13 01:16:01.395465+09	\N	\N
1ae300f5-024c-494b-8232-62c3f1e5ccaf	57bee07e-445e-4a98-8049-a2505ac55bd0	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	2	d0000000-0000-4000-8000-000000000305	\N	늦은 시간에도 가볍게 할 수 있어요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 22:16:01.395465+09	2026-11-13 01:16:01.395465+09	\N	\N
60f11a2c-3676-4ff9-8c54-964c3495d017	57bee07e-445e-4a98-8049-a2505ac55bd0	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	3	d0000000-0000-4000-8000-000000000303	\N	늦은 시간에도 가볍게 할 수 있어요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 20, "outdoorSuitable": true}	shown	2026-11-12 22:16:01.395465+09	2026-11-13 01:16:01.395465+09	\N	\N
7fc92e9b-f395-4db4-b10e-6af3026df7aa	182b3268-6372-4b67-8362-0649c245ef87	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	1	d0000000-0000-4000-8000-000000000306	\N	날씨가 좋아서 밖에서 달리기 좋아요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 12, "outdoorSuitable": true}	shown	2026-11-12 23:07:26.597231+09	2026-11-13 02:07:26.597231+09	\N	\N
097bacdb-8b36-4726-86ae-bd2fba66f462	182b3268-6372-4b67-8362-0649c245ef87	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	2	d0000000-0000-4000-8000-000000000305	\N	늦은 시간에도 가볍게 할 수 있어요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 12, "outdoorSuitable": true}	shown	2026-11-12 23:07:26.597231+09	2026-11-13 02:07:26.597231+09	\N	\N
00b6ca7b-cc57-4d6b-b9b6-1aba74634bf8	182b3268-6372-4b67-8362-0649c245ef87	situational_recommendation	3a1a615d-da53-4098-b81c-168537d9c5e7	3	d0000000-0000-4000-8000-000000000303	\N	늦은 시간에도 가볍게 할 수 있어요.	{"weather": "clear", "isMoving": false, "timeSlot": "night", "temperatureC": 12, "outdoorSuitable": true}	shown	2026-11-12 23:07:26.597231+09	2026-11-13 02:07:26.597231+09	\N	\N
\.


--
-- Data for Name: ai_plan_proposals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_plan_proposals (id, user_id, goal_id, generation_no, status, proposal_json, accepted_plan_json, generated_at, accepted_at) FROM stdin;
6a92d9da-9595-455c-85f3-0419705ed532	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	1	accepted	{"steps": [{"title": "1단계", "stepNo": 1, "dueDate": "2026-11-19", "missions": [{"title": "Squat50inamonth 1번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-13", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 2번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-16", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 3번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-18", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "2단계", "stepNo": 2, "dueDate": "2026-11-27", "missions": [{"title": "Squat50inamonth 4번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-21", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 5번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-24", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 6번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-26", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "3단계", "stepNo": 3, "dueDate": "2026-12-05", "missions": [{"title": "Squat50inamonth 7번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-11-29", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 8번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-12-02", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 9번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-12-04", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "4단계", "stepNo": 4, "dueDate": "2026-12-12", "missions": [{"title": "Squat50inamonth 10번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-12-07", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 11번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-12-09", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 12번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "exercise", "exerciseCode": null, "scheduledDate": "2026-12-11", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}], "summary": "2026-11-12부터 2026-12-12까지 4단계, 일주일에 약 3번 하는 계획이에요.", "engineVersion": "rule-plan@0.1.0"}	{"steps": [{"title": "1단계", "dueDate": "2026-11-19", "missions": [{"title": "Squat50inamonth 1번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-13", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 2번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-16", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 3번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-18", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}]}, {"title": "2단계", "dueDate": "2026-11-27", "missions": [{"title": "Squat50inamonth 4번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-21", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 5번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-24", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 6번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-26", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}]}, {"title": "3단계", "dueDate": "2026-12-05", "missions": [{"title": "Squat50inamonth 7번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-11-29", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 8번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-12-02", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 9번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-12-04", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}]}, {"title": "4단계", "dueDate": "2026-12-12", "missions": [{"title": "Squat50inamonth 10번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-12-07", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 11번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-12-09", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "Squat50inamonth 12번째", "categoryId": "d0000000-0000-4000-8000-000000000011", "isRequired": true, "difficultyId": "539a153f-647e-4103-b0eb-bc9c20b0b947", "scheduledDate": "2026-12-11", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}]}]}	2026-11-12 16:40:45.484389+09	2026-11-12 16:41:46.033507+09
2f4a1fd3-c230-409f-a3a4-58b826e2b8ab	3a1a615d-da53-4098-b81c-168537d9c5e7	b3975a43-e384-41be-8dc9-757e20b226d4	1	draft	{"steps": [{"title": "1단계", "stepNo": 1, "dueDate": "2026-11-19", "missions": [{"title": "ReadBooks 1번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-13", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 2번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-16", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 3번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-18", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "2단계", "stepNo": 2, "dueDate": "2026-11-27", "missions": [{"title": "ReadBooks 4번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-21", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 5번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-24", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 6번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-26", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "3단계", "stepNo": 3, "dueDate": "2026-12-05", "missions": [{"title": "ReadBooks 7번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-11-29", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 8번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-12-02", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 9번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-12-04", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}, {"title": "4단계", "stepNo": 4, "dueDate": "2026-12-12", "missions": [{"title": "ReadBooks 10번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-12-07", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 11번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-12-09", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}, {"title": "ReadBooks 12번째", "isRequired": true, "targetUnit": null, "description": null, "targetValue": null, "categoryCode": "study", "exerciseCode": null, "scheduledDate": "2026-12-11", "difficultyCode": "easy", "verificationMethod": "camera", "estimatedDurationSeconds": 1800}], "description": null}], "summary": "2026-11-12부터 2026-12-12까지 4단계, 일주일에 약 3번 하는 계획이에요.", "engineVersion": "rule-plan@0.1.0"}	\N	2026-11-12 21:50:12.764794+09	\N
\.


--
-- Data for Name: ai_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_reports (run_id, run_type, user_id, title, summary, content_json, generated_at, read_at, feedback, next_goals) FROM stdin;
8334e6ba-260c-45d3-a7a2-6a9fea596eef	weekly_report	3a1a615d-da53-4098-b81c-168537d9c5e7	지난주 리포트	시연용 가상 리포트입니다. 꾸준히 운동한 한 주였어요.	{"highlights": ["러닝 2회", "스트릭 시작"]}	2026-11-12 22:16:01.508282+09	\N	아침 시간대에 성공률이 높아요	\N
\.


--
-- Data for Name: challenge_daily_missions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_daily_missions (id, participation_id, challenge_id, user_id, challenge_date, mission_id, status, qualifying_record_id, qualifying_result_id, judged_at, created_at, updated_at) FROM stdin;
0e4721dd-18ff-4356-adf7-fca137acb3a3	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-14	627505ef-1250-48c3-8f83-05d526f2d380	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
73c4066e-0d73-4f0a-9a3c-5e5e2dd81b2f	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-15	63715946-6900-419e-954e-0ed719261f0c	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
532f6806-75ef-41ac-93a0-dc9dba443b3c	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-16	cfca58fc-6a21-4560-b86d-5d99f0299a3d	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
476b4de7-cd61-47ed-b6ce-18851141c2b7	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-17	490e312f-fa9d-4fa1-9a6f-a01b7a1ff4ed	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
481521b5-f366-4359-a956-f18d270fb999	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-18	456a0f01-850c-4565-97e0-7c8b574e114a	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
c86f8efb-265f-4500-a78f-c66165b61044	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-19	c8fcb1b6-9a80-4bad-b9bd-e2df24856cac	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
c15483d6-f01e-4548-99ec-4e36fe2237c8	e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-20	5bb70897-f1bd-427f-aa19-03071a70c124	pending	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09
5454c979-9f70-4de3-8ce5-2ac553dbf8df	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-06	9dec02ea-ac12-4e24-85cf-3f6f4bb8b84c	success	59f80d77-30d0-4122-8ee6-b4f2e93314d5	7336e49e-ab9e-4f9d-a619-00de9e0b60a9	2026-11-13 01:32:18.303115+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.303115+09
a7750d10-df1b-46be-b83f-3f30c0308b83	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-06	590e911e-e4ba-495b-97f9-97a1e75121f1	success	84718825-134a-4e13-8186-01d0cd244e6a	f5a8c566-4a03-449e-b67f-e47ebb4ce11e	2026-11-13 01:32:18.39453+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.39453+09
1465c95c-8e02-4e28-9735-db03fd4db10d	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-07	22b56590-a754-492f-97a4-88f618cd4ea9	success	ea1c96c2-64c5-455e-9d60-69ce790f6b93	ab0594d5-0702-4e1e-b29a-5ca4332af462	2026-11-13 01:32:18.669586+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.669586+09
86f022c5-1e23-4546-a2ba-dd1f47e0665f	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-07	4a340746-ebc2-465b-a461-54b685a81cbc	success	bad0252a-786b-438e-b8f1-3618f515fb14	cf0ccb3c-9379-4efe-be3e-93868e1daa8a	2026-11-13 01:32:18.756251+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.756251+09
7dc7bca1-5b0c-4a01-8225-8b55e1fc73a6	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-08	303c45bd-217b-4db4-bdba-9e222e35322d	success	d02f7e86-74ae-41f9-b75a-6b45921e1cbe	f00ec4f1-d60f-4a0b-b181-5308f044b295	2026-11-13 01:32:18.896608+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.896608+09
c48f4360-84d8-419b-a349-a9d9f204efb9	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-08	0797f874-d83f-4080-8ca5-07d2338a1213	failed	\N	\N	2026-11-13 01:32:18.96512+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.96512+09
4fdaf5e2-2828-44ef-961d-d9759b47ba9f	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-09	7325235f-3871-415e-9898-bb8a1df3fd38	failed	\N	\N	2026-11-13 01:32:18.96512+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.96512+09
320b76a4-020d-4d65-b8c0-54ad3804194e	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-10	a7168113-90d4-4bbe-b513-f2b96c1a4495	failed	\N	\N	2026-11-13 01:32:18.96512+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.96512+09
1a2aaac7-6c1d-420e-9497-55dec59a2289	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-11	2b387333-1e7f-4266-b65a-9a81e740ba82	failed	\N	\N	2026-11-13 01:32:18.96512+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.96512+09
f3aec470-cb6d-423a-9d1c-3c542b659ab5	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-09	5a8005e8-542d-42ad-a78d-b3c2c6ec2ad4	failed	\N	\N	2026-11-13 01:32:18.975991+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.975991+09
116aa241-c996-4318-8298-34b7d3a2483c	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-10	2d72ed28-8acd-4da2-9c30-4cfdd624bc43	failed	\N	\N	2026-11-13 01:32:18.975991+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.975991+09
30f2ea72-4808-4752-a1c7-600d9f835ada	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-11	d62a0920-8fb2-43af-8625-88676dd557ad	failed	\N	\N	2026-11-13 01:32:18.975991+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.975991+09
cc186159-a926-4678-b984-e977f30876e2	be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	2026-11-12	c475627e-2aa0-4eda-ae61-22830afd1c01	failed	\N	\N	2026-11-13 01:32:18.975991+09	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.975991+09
2a659473-bda0-4805-878f-cc7a953fe9f8	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-06	6c9147b1-ec7c-4d3b-ad12-76e56a5d242f	failed	\N	\N	2026-11-13 01:32:18.949646+09	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.949646+09
bfda411d-6a03-4e49-a9db-afc9c71a2689	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-07	ef122263-8c29-4c72-96d6-12b6efd32c1f	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
2c24a4e2-e914-439e-991a-20aeb46f36a3	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-08	439c25ae-6b79-4099-81ae-8fecdc67e1af	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
72715ab4-d18e-48f8-a553-e3fdddc74855	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-09	fcb9f414-19fa-4861-951b-f4f7a5ed7ecd	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
fa2377dc-2da6-4316-8b25-51215bf01e5f	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-10	281e4894-a0e4-4a80-b29d-9c703fedd340	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
3ffb11ad-52f6-43b1-8f3b-bdcb2daa0110	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-11	bce3f6ea-02b9-4857-839d-7d3d951cd942	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
a5ea7f4d-b458-4706-b640-a75e7078b1ba	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-12	ee355c02-01bd-4d9a-aa29-08fc4723cc94	failed	\N	\N	2026-11-13 01:32:18.956026+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.956026+09
e7ee2025-514c-4203-9c81-8c9cfc4843b4	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	2026-11-12	031c3078-fe65-4b4d-beb3-640d79e92ba7	failed	\N	\N	2026-11-13 01:32:18.96512+09	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.96512+09
613f8b55-f576-43fc-b49b-5378771f33d5	f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	2026-11-06	b60ad3f0-a3fd-469d-ac63-2d8b9476d17f	success	0576dd6f-f70a-4408-92e7-851958f4dec6	22be3168-5569-4fd6-a9e3-9d437b81d38d	2026-11-13 01:32:18.472229+09	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.472229+09
b183a384-eed3-4cec-aaa5-e8e99c35856c	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-06	754944e9-0e62-4c28-ae6b-5ef8657bb96a	success	367dfa7e-50bf-496a-8221-c10ee75ea68d	840c730a-8cf9-4fa5-9a30-0f05e5562873	2026-11-13 01:32:18.551755+09	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.551755+09
e43adb48-5704-4b24-a51c-2486ab9f4932	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-07	55c6c9ed-2d37-455c-9403-4080f1f49dcd	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
639f0ed3-1d49-44c2-8d43-12b4182277ab	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-08	475a19a5-efb4-473e-af0d-99660dc50f1b	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
514ca835-eee7-45f3-960b-0617e0b32322	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-09	c7988fc2-3632-4002-83ca-5404da490706	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
c46e77ad-56e9-4167-81d4-436a497ba953	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-10	b330a152-82d0-4c21-ad98-ba167b004170	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
b4751927-4bfe-4458-a3b3-614d65ce9150	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-11	5bac238b-5c01-49f8-bb3a-2008f122ee6a	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
f8f52b93-0483-4231-ab1b-61051f76555e	a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	2026-11-12	07dde0fe-a210-43ef-b17e-88fea298eec8	cancelled	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09
e08684da-8667-4b3e-a536-c75ad996f6d2	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-07	a737ee5c-3ad7-4e6f-a47b-ee9e4f15f8d6	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
164d8564-37cf-414d-a169-01591e89c570	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-08	8d051bb1-daab-4a08-ad50-174613dc3157	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
4132c2bd-2f0b-4f8b-9d52-fb177019196d	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-09	addd2ad3-2e47-4c0e-a77d-e2e25fe8744c	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
bfb8b20f-e195-4ded-b3c4-2e9aed7fc820	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-10	57511d33-f052-4fe2-b2cc-4cfa96250959	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
b02c640e-22ac-41df-aa7f-b9d0a5304692	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-11	7a2406be-4f2a-44db-a27d-c9cecdce338d	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
363eba84-d871-462c-ace0-87d55aec2a1b	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	2026-11-12	b2b221a4-e40c-43b3-9c31-a3e468784878	cancelled	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09
\.


--
-- Data for Name: challenge_final_rankings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_final_rankings (id, run_id, participation_id, rank_no, score, display_name, anonymized_at) FROM stdin;
a8d72229-8cb4-4fd4-9eb1-253171967c5a	1abff01d-99d8-45b9-8bfd-e599db301f74	be896788-9708-42ea-b3aa-15409399cd4e	1	300	정산시연A	\N
c27353c2-7c0e-4819-92c3-616b3c3560a1	1abff01d-99d8-45b9-8bfd-e599db301f74	ee4605d4-1589-48e7-8596-64be63f25566	2	200	정산시연B	\N
168729bb-f88a-4f93-bf4c-cf81e1e89fc3	1abff01d-99d8-45b9-8bfd-e599db301f74	f96e81b3-a638-441b-ab68-c4ba8eb44b35	3	100	정산시연C	\N
\.


--
-- Data for Name: challenge_moderation_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_moderation_actions (id, participation_id, daily_mission_id, admin_id, action, reason, evidence_result_id, occurred_at) FROM stdin;
e4f0885e-f773-42c0-9bac-6e9fb50710aa	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	\N	d0000000-0000-4000-8000-000000000001	disqualify	시연: 부정 행위 의심	\N	2026-11-13 01:32:18.811299+09
\.


--
-- Data for Name: challenge_participations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_participations (id, challenge_id, user_id, status, joined_at, withdrawn_at, completed_at, updated_at) FROM stdin;
e8a32c6f-628e-4ba7-a35d-18a1f728ca65	0393db21-215c-4286-b2ed-f3ee5919240c	3a1a615d-da53-4098-b81c-168537d9c5e7	enrolled	2026-11-12 22:16:00.595325+09	\N	\N	2026-11-12 22:16:00.595325+09
a54c7244-9905-41de-8110-66bcb63b91aa	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ef98fa2f-8486-4767-b11e-d00e5948cfd2	withdrawn	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.793098+09
47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a45a1748-0674-4ebe-9b85-c0496143c495	disqualified	2026-11-13 01:32:18.192563+09	\N	\N	2026-11-13 01:32:18.811299+09
be896788-9708-42ea-b3aa-15409399cd4e	231d3c59-ac93-4c12-bb2d-fef9c17b6972	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	completed	2026-11-13 01:32:18.028639+09	\N	2026-11-13 01:32:19.020061+09	2026-11-13 01:32:19.020061+09
ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	completed	2026-11-13 01:32:18.073437+09	\N	2026-11-13 01:32:19.020061+09	2026-11-13 01:32:19.020061+09
f96e81b3-a638-441b-ab68-c4ba8eb44b35	231d3c59-ac93-4c12-bb2d-fef9c17b6972	9c7af070-c543-4e0a-ba19-5dab3ceefad3	failed	2026-11-13 01:32:18.123276+09	\N	\N	2026-11-13 01:32:19.020061+09
\.


--
-- Data for Name: challenge_publication_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_publication_reviews (id, challenge_id, requested_by_user_id, reviewed_by_admin_id, decision, reason, created_at) FROM stdin;
12b4c323-b30e-4624-b035-25542ef04c74	094edbed-7d71-4b2e-aa28-37aa2a54797e	ad2ee538-8b45-4a7d-af16-84eba6f995e4	\N	submitted	\N	2026-11-13 01:32:17.258998+09
f415a5ca-eb42-40e3-97fc-6438b47befea	094edbed-7d71-4b2e-aa28-37aa2a54797e	\N	d0000000-0000-4000-8000-000000000001	approved	공개해도 좋은 챌린지예요.	2026-11-13 01:32:17.27858+09
eab32b9f-421b-4902-9718-63d969d96656	6acaaef0-b63e-4267-a74e-9bc563db6b61	ad2ee538-8b45-4a7d-af16-84eba6f995e4	\N	submitted	\N	2026-11-13 01:32:17.31976+09
366c1409-10e6-4167-a5e0-698eb737c157	6acaaef0-b63e-4267-a74e-9bc563db6b61	\N	d0000000-0000-4000-8000-000000000001	rejected	목표가 구체적이지 않아 반려해요.	2026-11-13 01:32:17.333609+09
\.


--
-- Data for Name: challenge_reward_grants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_reward_grants (id, participation_id, challenge_id, user_id, first_settlement_run_id, promised_points, paid_points, user_xp, pet_xp, recipient_pet_id, badge_grant_id, status, granted_at, updated_at) FROM stdin;
5ad0c018-a8d0-4b51-a024-908fd427b21b	ee4605d4-1589-48e7-8596-64be63f25566	231d3c59-ac93-4c12-bb2d-fef9c17b6972	29240605-e884-4515-bf20-783bb736f55a	1abff01d-99d8-45b9-8bfd-e599db301f74	300	300	30	60	\N	\N	active	2026-11-13 01:32:19.063903+09	2026-11-13 01:32:19.063903+09
\.


--
-- Data for Name: challenge_reward_packages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_reward_packages (challenge_id, points, user_xp, pet_xp, badge_achievement_version_id, created_at) FROM stdin;
d0000000-0000-4000-8000-000000000701	500	100	50	\N	2026-11-09 20:23:23.649051+09
0393db21-215c-4286-b2ed-f3ee5919240c	500	100	50	\N	2026-11-12 22:16:00.299844+09
094edbed-7d71-4b2e-aa28-37aa2a54797e	0	0	0	\N	2026-11-13 01:32:17.228609+09
6acaaef0-b63e-4267-a74e-9bc563db6b61	0	0	0	\N	2026-11-13 01:32:17.30037+09
231d3c59-ac93-4c12-bb2d-fef9c17b6972	300	30	60	\N	2026-11-13 01:32:17.364694+09
\.


--
-- Data for Name: challenge_reward_payment_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_reward_payment_attempts (run_id, participation_id, attempt_count, last_error, last_attempt_at, next_retry_at, locked_until, updated_at) FROM stdin;
1abff01d-99d8-45b9-8bfd-e599db301f74	be896788-9708-42ea-b3aa-15409399cd4e	1	시연: 포인트 서비스 일시 장애	2026-11-13 01:32:19.059267+09	2026-11-13 01:33:19.059267+09	\N	2026-11-13 01:32:19.059267+09
\.


--
-- Data for Name: challenge_rule_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_rule_events (id, challenge_id, admin_id, requested_by_user_id, event_type, reason, occurred_at) FROM stdin;
3e28663e-6d1b-4600-ab1c-3444d2c0527e	0393db21-215c-4286-b2ed-f3ee5919240c	d0000000-0000-4000-8000-000000000001	\N	published	공개	2026-11-12 22:16:00.471508+09
3d24cc2c-5e70-4635-b440-bfd00b19eb7f	094edbed-7d71-4b2e-aa28-37aa2a54797e	d0000000-0000-4000-8000-000000000001	\N	published	공개해도 좋은 챌린지예요.	2026-11-13 01:32:17.27858+09
fc0d7235-5bbc-4034-9073-8272ed578d89	231d3c59-ac93-4c12-bb2d-fef9c17b6972	d0000000-0000-4000-8000-000000000001	\N	published	공개	2026-11-13 01:32:17.386055+09
\.


--
-- Data for Name: challenge_score_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_score_snapshots (challenge_id, participation_id, successful_days, last_qualifying_submitted_at, calculated_at) FROM stdin;
\.


--
-- Data for Name: challenge_settlement_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_settlement_entries (run_id, challenge_id, participation_id, successful_days, last_qualifying_submitted_at, rank_no, outcome, exclusion_reason, promised_points, paid_points, user_xp, pet_xp, payment_status) FROM stdin;
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	f96e81b3-a638-441b-ab68-c4ba8eb44b35	1	2026-11-06 01:32:18.455589+09	3	failed	\N	0	0	0	0	none
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	a54c7244-9905-41de-8110-66bcb63b91aa	0	\N	\N	withdrawn	자진 포기	0	0	0	0	none
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	47f60e97-2d6c-48c2-b9ae-05a15e2a95cb	1	2026-11-06 01:32:18.53419+09	\N	disqualified	시연: 부정 행위 의심	0	0	0	0	none
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	be896788-9708-42ea-b3aa-15409399cd4e	3	2026-11-08 01:32:18.881097+09	1	completed	\N	300	0	30	60	failed
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	ee4605d4-1589-48e7-8596-64be63f25566	2	2026-11-07 01:32:18.738848+09	2	completed	\N	300	300	30	60	paid
\.


--
-- Data for Name: challenge_settlement_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenge_settlement_runs (id, challenge_id, run_no, status, based_on_at, confirmed_by_admin_id, confirmed_at, reason, created_at) FROM stdin;
1abff01d-99d8-45b9-8bfd-e599db301f74	231d3c59-ac93-4c12-bb2d-fef9c17b6972	1	confirmed	2026-11-13 01:32:18.989429+09	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:19.020061+09	시연 정산 확정	2026-11-13 01:32:18.989429+09
\.


--
-- Data for Name: challenges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenges (id, origin, created_by_user_id, created_by_admin_id, title, description, category_id, difficulty_id, verification_method, target_value, target_unit, estimated_duration_seconds, start_date, end_date, required_success_days, max_participants, publication_status, settlement_status, published_at, cancelled_at, created_at, updated_at, exercise_code) FROM stdin;
d0000000-0000-4000-8000-000000000701	admin	\N	d0000000-0000-4000-8000-000000000001	7일 스쿼트 챌린지	7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	camera	20.00	reps	180	2026-11-11	2026-11-17	6	\N	public	not_started	2026-11-09 20:23:23.649051+09	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	squat
0393db21-215c-4286-b2ed-f3ee5919240c	admin	\N	d0000000-0000-4000-8000-000000000001	7일 스쿼트 챌린지(시연)	7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	camera	20.00	reps	180	2026-11-14	2026-11-20	6	\N	public	not_started	2026-11-12 22:16:00.471508+09	\N	2026-11-12 22:16:00.299844+09	2026-11-12 22:16:00.471508+09	squat
094edbed-7d71-4b2e-aa28-37aa2a54797e	user	ad2ee538-8b45-4a7d-af16-84eba6f995e4	\N	함께 걷는 주간 챌린지	시연용 챌린지예요.	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	sensor	\N	\N	\N	2026-11-23	2026-11-29	2	\N	public	not_started	2026-11-13 01:32:17.27858+09	\N	2026-11-13 01:32:17.228609+09	2026-11-13 01:32:17.27858+09	running
6acaaef0-b63e-4267-a74e-9bc563db6b61	user	ad2ee538-8b45-4a7d-af16-84eba6f995e4	\N	검수 반려 시연 챌린지	시연용 챌린지예요.	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	sensor	\N	\N	\N	2026-11-23	2026-11-29	2	\N	rejected	not_started	\N	\N	2026-11-13 01:32:17.30037+09	2026-11-13 01:32:17.333609+09	running
231d3c59-ac93-4c12-bb2d-fef9c17b6972	admin	\N	d0000000-0000-4000-8000-000000000001	시연 정산 챌린지	시연용 챌린지예요.	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	sensor	\N	\N	\N	2026-11-06	2026-11-12	2	\N	public	confirmed	2026-11-13 01:32:17.386055+09	\N	2026-11-13 01:32:17.364694+09	2026-11-13 01:32:19.020061+09	running
\.


--
-- Data for Name: consent_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consent_records (id, user_id, document_version_id, granted, recorded_at) FROM stdin;
67b6f7c5-5b22-4790-9f02-48a938db0f74	d0000000-0000-4000-8000-000000000601	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-09 20:23:23.649051+09
658e8992-edd1-4443-ac89-27a8e7e881ab	d0000000-0000-4000-8000-000000000601	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-09 20:23:23.649051+09
a49c9cf8-37a7-4deb-b2e4-c328cc1ed2a3	d0000000-0000-4000-8000-000000000601	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-09 20:23:23.649051+09
919e6e06-2053-49b9-a5fe-49ca4df8bba1	3a1a615d-da53-4098-b81c-168537d9c5e7	915ee0e8-4f8a-46ab-a904-50b32d734bf1	f	2026-11-12 16:25:02.306978+09
19f72ba1-60ac-460f-a3b0-2541518acb1e	3a1a615d-da53-4098-b81c-168537d9c5e7	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-12 16:25:02.306978+09
35ed56a3-14fa-405e-99d2-1fd1d0208dea	3a1a615d-da53-4098-b81c-168537d9c5e7	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-12 16:25:02.306978+09
84da0671-b1ae-4ad7-944e-290c4ae9941b	389e1d24-ebcf-4081-898b-e9489d21d682	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:16.60814+09
2b2bdb51-b1f5-44d6-8f58-32a1dc0ad957	389e1d24-ebcf-4081-898b-e9489d21d682	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:16.60814+09
78aadd37-689d-4584-aa77-b3619c6c4f3c	389e1d24-ebcf-4081-898b-e9489d21d682	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:16.60814+09
d324ac00-b31f-4979-a92b-2ba28a8d9f02	91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:16.791076+09
1e67242a-259d-4487-ab34-91d3af9f7b5c	91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:16.791076+09
f82ca8bd-bbc3-44a7-8734-100caa337db1	91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:16.791076+09
6e3eb50b-7f21-4660-be40-02dd85ed8326	ad2ee538-8b45-4a7d-af16-84eba6f995e4	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:17.199237+09
40602d2e-5f61-43c0-8ec6-7d3896934e15	ad2ee538-8b45-4a7d-af16-84eba6f995e4	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:17.199237+09
4fcfa78c-39eb-4948-8bed-21f9f719a424	ad2ee538-8b45-4a7d-af16-84eba6f995e4	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:17.199237+09
2bf1d31a-422b-4435-b6db-9b601c7d4d07	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:17.497324+09
147b072d-f8b1-44b4-a183-9a78f423676c	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:17.497324+09
5a063bf4-0aff-4c6a-a427-5493db476406	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:17.497324+09
f4b9ea44-c617-473b-b136-f5085862df1e	29240605-e884-4515-bf20-783bb736f55a	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:17.598587+09
d3378964-cee2-4fbb-9dec-d17fcd0707f7	29240605-e884-4515-bf20-783bb736f55a	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:17.598587+09
82fa8b4c-9cd4-4f49-83a1-e4762bb1e221	29240605-e884-4515-bf20-783bb736f55a	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:17.598587+09
1b8da544-8b3a-4c3a-bb69-b324a9ba1b21	9c7af070-c543-4e0a-ba19-5dab3ceefad3	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:17.713912+09
78c19d23-4472-4d16-856c-a13be638b771	9c7af070-c543-4e0a-ba19-5dab3ceefad3	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:17.713912+09
09712efe-70b0-4589-bf06-1ac9a3866316	9c7af070-c543-4e0a-ba19-5dab3ceefad3	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:17.713912+09
9b7ab56d-b803-4d1e-949e-b815aa494714	ef98fa2f-8486-4767-b11e-d00e5948cfd2	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:17.846956+09
d759ed17-d763-4937-87c0-3e860b611ea3	ef98fa2f-8486-4767-b11e-d00e5948cfd2	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:17.846956+09
2991910e-e0d2-49d6-aeaa-2959912afecc	ef98fa2f-8486-4767-b11e-d00e5948cfd2	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:17.846956+09
fb2e6e6b-f6a9-4354-bf8c-d102b7692afd	a45a1748-0674-4ebe-9b85-c0496143c495	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:18.003838+09
6e3b1db0-559e-48e3-b1b9-f4d127a42eb5	a45a1748-0674-4ebe-9b85-c0496143c495	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:18.003838+09
4496c018-3737-49b6-a147-bd52ad2aafa8	a45a1748-0674-4ebe-9b85-c0496143c495	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:18.003838+09
0a717d9d-c50c-42fb-8acc-4d7b5f1cf474	644c7f97-852d-4339-97af-0e0deb46ac54	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:19.239128+09
90c8ae69-38e1-4cbd-a518-4bccf88c01d8	644c7f97-852d-4339-97af-0e0deb46ac54	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:19.239128+09
647ffd48-0f8f-49d4-9a2a-fde6b2049f14	644c7f97-852d-4339-97af-0e0deb46ac54	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:19.239128+09
687adc58-ea58-4611-904b-e9a4ff474cd8	b60ef6c5-f266-49ad-b850-21bd49a3916d	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:20.47098+09
52b67c9b-bd26-49cd-b4a7-21827e97f0be	b60ef6c5-f266-49ad-b850-21bd49a3916d	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:20.47098+09
20ac5f83-3313-4457-9315-c9cb04abfc5f	b60ef6c5-f266-49ad-b850-21bd49a3916d	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:20.47098+09
be9fb219-2bc8-43a3-a703-f397e572768f	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	t	2026-11-13 01:32:20.806656+09
5053646e-7ad0-4eaa-b3b2-2a28bd1f72e6	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	685fb01b-211a-4f52-97cc-48a307dbd021	t	2026-11-13 01:32:20.806656+09
125157ee-0346-4f98-8806-a55dc6398e3b	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	915ee0e8-4f8a-46ab-a904-50b32d734bf1	t	2026-11-13 01:32:20.806656+09
\.


--
-- Data for Name: difficulty_levels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.difficulty_levels (id, code, name, display_order, is_active, created_at, updated_at) FROM stdin;
34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	easy	쉬움	1	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
539a153f-647e-4103-b0eb-bc9c20b0b947	normal	보통	2	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
c757fa32-d5ad-4a4d-8450-2bf62c97f02f	hard	어려움	3	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
\.


--
-- Data for Name: experience_awards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.experience_awards (id, user_id, source_type, source_id, recipient_pet_id, base_user_xp, base_pet_xp, bonus_pet_xp, pet_species_version_id, pet_stage_no, bonus_basis_points, status, first_awarded_at, updated_at) FROM stdin;
32bd1961-d19d-4b44-89d7-166fa34c24d7	3a1a615d-da53-4098-b81c-168537d9c5e7	mission	13600eba-abb3-4336-81c6-600f64f70d0d	8284b275-778f-45f4-81f0-5d12c87c5341	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-12 22:13:54.780597+09	2026-11-12 22:13:54.780597+09
dbdffdb6-5f12-42b0-a151-5cd446dcd914	3a1a615d-da53-4098-b81c-168537d9c5e7	achievement	37fa1f67-5ea2-4e86-bdcd-d1174981e219	8284b275-778f-45f4-81f0-5d12c87c5341	100	0	0	d0000000-0000-4000-8000-000000000111	1	0	active	2026-11-12 22:13:56.295155+09	2026-11-12 22:13:56.295155+09
4a65e9f6-a1c9-467c-8816-950f938c94e4	29240605-e884-4515-bf20-783bb736f55a	challenge	5ad0c018-a8d0-4b51-a024-908fd427b21b	\N	30	60	0	\N	\N	0	active	2026-11-13 01:32:19.063903+09	2026-11-13 01:32:19.063903+09
ee719ab2-e1d3-48eb-bba8-7abb4a4f463b	644c7f97-852d-4339-97af-0e0deb46ac54	mission	b8dfabd4-fcd8-495f-8138-467300129b2f	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.302065+09	2026-11-13 01:32:19.302065+09
9153fad3-1ef7-4f9f-af1d-4f2e62e526f4	644c7f97-852d-4339-97af-0e0deb46ac54	mission	004d6b39-2372-4ac3-8bcf-8f2da9a99eed	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.404851+09	2026-11-13 01:32:19.404851+09
e5ab81bc-77f8-4063-800b-e222a1c6e25b	644c7f97-852d-4339-97af-0e0deb46ac54	mission	2f1cfbee-4245-4815-ace9-239a4bd02cdb	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.524537+09	2026-11-13 01:32:19.524537+09
09b4d531-47c7-4ec4-a793-f64087403964	644c7f97-852d-4339-97af-0e0deb46ac54	mission	f5fb5a30-423e-4cd8-af24-d569aaea8544	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.655661+09	2026-11-13 01:32:19.655661+09
5f6cafa4-2cdf-44ca-af24-23c50f6af17c	644c7f97-852d-4339-97af-0e0deb46ac54	mission	94657b05-ad70-4aee-abf7-ae2883bdd331	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.761194+09	2026-11-13 01:32:19.761194+09
888dd7a5-eb7f-461e-b740-14d3d244695d	644c7f97-852d-4339-97af-0e0deb46ac54	mission	f54a376a-6784-482c-9cdb-203df6894413	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:19.90753+09	2026-11-13 01:32:19.90753+09
38f1cbf4-e1ef-40fc-b286-58d31588d811	644c7f97-852d-4339-97af-0e0deb46ac54	mission	5ddf1331-2d68-482b-80cf-f575076bc590	\N	20	10	0	\N	\N	0	active	2026-11-13 01:32:20.050038+09	2026-11-13 01:32:20.050038+09
4b0c356f-928c-4bf3-ba53-f6a193f76b41	b60ef6c5-f266-49ad-b850-21bd49a3916d	mission	dab32a54-395a-41b3-a909-1a0e9573bfdb	\N	20	10	0	\N	\N	0	revoked	2026-11-13 01:32:20.550489+09	2026-11-13 01:32:20.615144+09
f541fd04-ab9b-4ef2-b714-d3e62be5af57	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	mission	cd187669-fdbb-4498-bf15-d1400cd645df	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-13 01:32:20.973576+09	2026-11-13 01:32:20.973576+09
ec5433dd-3b4b-4e50-977b-5b66f4068845	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	mission	65960e23-35c7-4eb8-9777-85c12cc04bea	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-13 01:32:21.156807+09	2026-11-13 01:32:21.156807+09
516b7a3c-5ec9-43c0-a4f0-084131e0b59d	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	mission	439ad5a3-1d36-4fc8-a1fd-5fa9492743be	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-13 01:32:21.259333+09	2026-11-13 01:32:21.259333+09
36c4b76d-ce40-4701-a72a-ce2ebe7c6dd7	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	mission	31567496-c7cb-41e4-b0e0-f9e1b5684543	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-13 01:32:21.360127+09	2026-11-13 01:32:21.360127+09
d1263ebd-dcc5-48a4-85a9-90b3cffef8aa	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	mission	da3e831b-31d4-468e-8081-1f7de3622a71	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	20	10	0	d0000000-0000-4000-8000-000000000111	1	500	active	2026-11-13 01:32:21.464338+09	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: experience_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.experience_transactions (id, user_id, recipient_kind, user_pet_id, experience_award_id, xp_delta, balance_after, kind, original_transaction_id, idempotency_key, created_by_admin_id, reason, occurred_at) FROM stdin;
0d4d57b8-85fd-4c84-8127-c3e15be83b27	3a1a615d-da53-4098-b81c-168537d9c5e7	user	\N	32bd1961-d19d-4b44-89d7-166fa34c24d7	20	20	award	\N	xp:award:32bd1961-d19d-4b44-89d7-166fa34c24d7:user	\N	\N	2026-11-12 22:13:54.780597+09
7e2c2e2f-713c-4b21-b686-d179fb8ff84b	3a1a615d-da53-4098-b81c-168537d9c5e7	pet	8284b275-778f-45f4-81f0-5d12c87c5341	32bd1961-d19d-4b44-89d7-166fa34c24d7	10	10	award	\N	xp:award:32bd1961-d19d-4b44-89d7-166fa34c24d7:pet	\N	\N	2026-11-12 22:13:54.780597+09
02404b27-e9fc-4c73-9533-83f542c98ec1	3a1a615d-da53-4098-b81c-168537d9c5e7	user	\N	dbdffdb6-5f12-42b0-a151-5cd446dcd914	100	120	award	\N	xp:award:dbdffdb6-5f12-42b0-a151-5cd446dcd914:user	\N	\N	2026-11-12 22:13:56.295155+09
26cbcb80-7faa-4323-a6e8-18526000e9a1	29240605-e884-4515-bf20-783bb736f55a	user	\N	4a65e9f6-a1c9-467c-8816-950f938c94e4	30	30	award	\N	xp:award:4a65e9f6-a1c9-467c-8816-950f938c94e4:user	\N	\N	2026-11-13 01:32:19.063903+09
ca0d7172-0a50-423a-b7fb-3cfbec6fde25	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	ee719ab2-e1d3-48eb-bba8-7abb4a4f463b	20	20	award	\N	xp:award:ee719ab2-e1d3-48eb-bba8-7abb4a4f463b:user	\N	\N	2026-11-13 01:32:19.302065+09
9751c910-850e-4b09-8c6f-12fa6f1da930	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	9153fad3-1ef7-4f9f-af1d-4f2e62e526f4	20	40	award	\N	xp:award:9153fad3-1ef7-4f9f-af1d-4f2e62e526f4:user	\N	\N	2026-11-13 01:32:19.404851+09
0bdc00a2-a8ba-4cdb-836f-cf31b4ab71cd	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	e5ab81bc-77f8-4063-800b-e222a1c6e25b	20	60	award	\N	xp:award:e5ab81bc-77f8-4063-800b-e222a1c6e25b:user	\N	\N	2026-11-13 01:32:19.524537+09
344531f9-a837-4f01-9648-d5f2234ca9c7	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	09b4d531-47c7-4ec4-a793-f64087403964	20	80	award	\N	xp:award:09b4d531-47c7-4ec4-a793-f64087403964:user	\N	\N	2026-11-13 01:32:19.655661+09
97172e7e-e08c-47e1-93f1-fd086445001f	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	5f6cafa4-2cdf-44ca-af24-23c50f6af17c	20	100	award	\N	xp:award:5f6cafa4-2cdf-44ca-af24-23c50f6af17c:user	\N	\N	2026-11-13 01:32:19.761194+09
86105b0a-925e-472d-852a-fe6115ceb85d	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	888dd7a5-eb7f-461e-b740-14d3d244695d	20	120	award	\N	xp:award:888dd7a5-eb7f-461e-b740-14d3d244695d:user	\N	\N	2026-11-13 01:32:19.90753+09
6c45c6bd-04dc-41a3-b5fe-f29713670e0c	644c7f97-852d-4339-97af-0e0deb46ac54	user	\N	38f1cbf4-e1ef-40fc-b286-58d31588d811	20	140	award	\N	xp:award:38f1cbf4-e1ef-40fc-b286-58d31588d811:user	\N	\N	2026-11-13 01:32:20.050038+09
9b9e2494-ad86-4259-9a03-03544745f1d5	b60ef6c5-f266-49ad-b850-21bd49a3916d	user	\N	4b0c356f-928c-4bf3-ba53-f6a193f76b41	20	20	award	\N	xp:award:4b0c356f-928c-4bf3-ba53-f6a193f76b41:user	\N	\N	2026-11-13 01:32:20.550489+09
eb551ed4-4249-4edd-986e-d1a0daa11b01	b60ef6c5-f266-49ad-b850-21bd49a3916d	user	\N	4b0c356f-928c-4bf3-ba53-f6a193f76b41	-20	0	reversal	9b9e2494-ad86-4259-9a03-03544745f1d5	xp:reversal:4b0c356f-928c-4bf3-ba53-f6a193f76b41:d7fa93a2-fe51-4230-b50d-3748223bba90:user	\N	\N	2026-11-13 01:32:20.615144+09
244f780a-c5e2-4384-97d7-813f7368a416	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	user	\N	f541fd04-ab9b-4ef2-b714-d3e62be5af57	20	20	award	\N	xp:award:f541fd04-ab9b-4ef2-b714-d3e62be5af57:user	\N	\N	2026-11-13 01:32:20.973576+09
4711370e-8d1e-4a26-bd70-f0755a119d7e	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	pet	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	f541fd04-ab9b-4ef2-b714-d3e62be5af57	10	10	award	\N	xp:award:f541fd04-ab9b-4ef2-b714-d3e62be5af57:pet	\N	\N	2026-11-13 01:32:20.973576+09
2270ea05-b63c-4450-b23c-2dfd93de0804	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	user	\N	ec5433dd-3b4b-4e50-977b-5b66f4068845	20	40	award	\N	xp:award:ec5433dd-3b4b-4e50-977b-5b66f4068845:user	\N	\N	2026-11-13 01:32:21.156807+09
3ce9322a-e51a-4fd5-aa6d-66e2b0324580	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	pet	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	ec5433dd-3b4b-4e50-977b-5b66f4068845	10	20	award	\N	xp:award:ec5433dd-3b4b-4e50-977b-5b66f4068845:pet	\N	\N	2026-11-13 01:32:21.156807+09
cf5877e9-2232-439d-8388-b3cf8a770fef	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	user	\N	516b7a3c-5ec9-43c0-a4f0-084131e0b59d	20	60	award	\N	xp:award:516b7a3c-5ec9-43c0-a4f0-084131e0b59d:user	\N	\N	2026-11-13 01:32:21.259333+09
3c21c61a-2d32-4b56-848f-cbcef67282ab	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	pet	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	516b7a3c-5ec9-43c0-a4f0-084131e0b59d	10	30	award	\N	xp:award:516b7a3c-5ec9-43c0-a4f0-084131e0b59d:pet	\N	\N	2026-11-13 01:32:21.259333+09
db79dc3e-f9b6-4896-a1ee-551fa0e9eeaa	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	user	\N	36c4b76d-ce40-4701-a72a-ce2ebe7c6dd7	20	80	award	\N	xp:award:36c4b76d-ce40-4701-a72a-ce2ebe7c6dd7:user	\N	\N	2026-11-13 01:32:21.360127+09
725e802d-fd22-4fba-a876-ea9a2be76cb1	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	pet	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	36c4b76d-ce40-4701-a72a-ce2ebe7c6dd7	10	40	award	\N	xp:award:36c4b76d-ce40-4701-a72a-ce2ebe7c6dd7:pet	\N	\N	2026-11-13 01:32:21.360127+09
92a79bf8-8203-486a-bcfc-ac08fe1524c6	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	user	\N	d1263ebd-dcc5-48a4-85a9-90b3cffef8aa	20	100	award	\N	xp:award:d1263ebd-dcc5-48a4-85a9-90b3cffef8aa:user	\N	\N	2026-11-13 01:32:21.464338+09
bb5e1a0d-6527-4410-bee2-deced06b9e57	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	pet	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	d1263ebd-dcc5-48a4-85a9-90b3cffef8aa	10	50	award	\N	xp:award:d1263ebd-dcc5-48a4-85a9-90b3cffef8aa:pet	\N	\N	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: goal_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.goal_categories (id, code, name, display_order, is_active, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000011	exercise	운동	1	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
d0000000-0000-4000-8000-000000000012	study	학습	2	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
d0000000-0000-4000-8000-000000000013	lifestyle	생활습관	3	t	2026-11-09 20:23:23.066855+09	2026-11-09 20:23:23.066855+09
\.


--
-- Data for Name: goal_steps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.goal_steps (id, goal_id, step_no, title, description, due_date, status, completed_at, created_at, updated_at) FROM stdin;
86dd6a18-8f6c-496c-bf76-ebe6b4fff794	827608c0-60a2-4f85-ab99-58dbe4a1325c	1	1단계	\N	2026-11-19	active	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09
f1bbacc1-fa12-49ec-be2b-cfa59a3711f8	827608c0-60a2-4f85-ab99-58dbe4a1325c	2	2단계	\N	2026-11-27	active	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09
95a74e75-c52c-4d9e-ac7f-2fd5efcb2dd2	827608c0-60a2-4f85-ab99-58dbe4a1325c	3	3단계	\N	2026-12-05	active	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09
86d726a4-4a8d-48bc-a656-5dd13136f699	827608c0-60a2-4f85-ab99-58dbe4a1325c	4	4단계	\N	2026-12-12	active	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09
9864be1b-2bff-4a10-a2af-8cc413d66ee1	ced49867-b656-4b4f-a745-aa195b6ac979	1	1주차: 몸 풀기	가벼운 운동으로 시작	2026-11-19	active	\N	2026-11-12 22:13:53.791917+09	2026-11-12 22:13:53.791917+09
\.


--
-- Data for Name: goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.goals (id, user_id, category_id, difficulty_id, title, description, start_date, end_date, target_frequency, status, completed_at, deleted_at, created_at, updated_at, daily_available_minutes) FROM stdin;
827608c0-60a2-4f85-ab99-58dbe4a1325c	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	Squat50inamonth	\N	2026-11-12	2026-12-12	3	paused	\N	\N	2026-11-12 16:40:44.676124+09	2026-11-12 17:10:58.291785+09	\N
b3975a43-e384-41be-8dc9-757e20b226d4	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000012	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	ReadBooks	\N	2026-11-12	2026-12-12	3	active	\N	2026-11-12 21:50:40.291037+09	2026-11-12 21:50:12.342815+09	2026-11-12 21:50:40.291037+09	\N
ced49867-b656-4b4f-a745-aa195b6ac979	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	한 달 운동 습관 만들기	매일 조금씩 운동하기	2026-11-12	2026-12-12	5	active	\N	\N	2026-11-12 22:13:53.516149+09	2026-11-12 22:13:53.516149+09	30
2b93ba45-8852-4c6b-b059-202aa4ba12f6	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	첫 걸음	\N	2026-11-12	2026-11-19	\N	completed	2026-11-12 22:13:56.295155+09	\N	2026-11-12 22:13:56.208968+09	2026-11-12 22:13:56.295155+09	\N
\.


--
-- Data for Name: media_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media_files (id, user_id, record_id, object_key, media_kind, mime_type, expected_size_bytes, actual_size_bytes, checksum_sha256, upload_status, upload_url_expires_at, uploaded_at, deleted_at, created_at, updated_at) FROM stdin;
64c14ad3-900f-488d-ab78-c7ed5ec818a6	3a1a615d-da53-4098-b81c-168537d9c5e7	dbf07b15-952b-480d-9fae-04adb78f6204	dev/users/3a1a615d-da53-4098-b81c-168537d9c5e7/records/dbf07b15-952b-480d-9fae-04adb78f6204/64c14ad3-900f-488d-ab78-c7ed5ec818a6.jpg	camera_photo	image/jpeg	33149	\N	bbeaf28b183ff793361448acedf6470048c0017619af8ac0182c83459aa85bba	deleted	2026-11-12 17:02:14.545558+09	\N	2026-11-12 16:49:00.290805+09	2026-11-12 16:47:14.545558+09	2026-11-12 16:49:00.290805+09
74ef3c0e-644e-4e7d-9f5f-0302b8c18c3d	3a1a615d-da53-4098-b81c-168537d9c5e7	66813fa4-eb36-41ff-a5d5-772496d87840	dev/users/3a1a615d-da53-4098-b81c-168537d9c5e7/records/66813fa4-eb36-41ff-a5d5-772496d87840/74ef3c0e-644e-4e7d-9f5f-0302b8c18c3d.jpg	camera_photo	image/jpeg	32173	32173	669f7f20bcc9acff30aae544d6c1340bc64fdf721fc0031bcceb3b425b6334ed	uploaded	2026-11-12 20:10:13.393531+09	2026-11-12 19:55:16.239221+09	\N	2026-11-12 19:55:13.393531+09	2026-11-12 19:55:16.239221+09
1a4bd822-68bb-43bd-bf5e-7645cc8b68aa	3a1a615d-da53-4098-b81c-168537d9c5e7	cd5b37ee-61c2-4a98-a552-2ffa4ba2e3fe	dev/users/3a1a615d-da53-4098-b81c-168537d9c5e7/records/cd5b37ee-61c2-4a98-a552-2ffa4ba2e3fe/1a4bd822-68bb-43bd-bf5e-7645cc8b68aa.jpg	camera_photo	image/jpeg	32825	32825	dad853652237c35c579cc331f624a8edec8d20ea47efd34b7e16925dbbf2cfda	uploaded	2026-11-12 20:13:06.734953+09	2026-11-12 19:58:11.833666+09	\N	2026-11-12 19:58:06.734953+09	2026-11-12 19:58:11.833666+09
6ec5b473-16d7-4ef4-a5f7-b0bf5e44fe76	3a1a615d-da53-4098-b81c-168537d9c5e7	05c6f57a-8f16-4ccf-bf3e-100e799c9749	dev/users/3a1a615d-da53-4098-b81c-168537d9c5e7/records/05c6f57a-8f16-4ccf-bf3e-100e799c9749/6ec5b473-16d7-4ef4-a5f7-b0bf5e44fe76.mp4	camera_video	video/mp4	65969	65969	b9727da1cc8ea3afc44c65a970ff7ade7caf3810ce192bb725aeb725d4f3fd13	uploaded	2026-11-12 20:27:30.878909+09	2026-11-12 20:12:33.597721+09	\N	2026-11-12 20:12:30.878909+09	2026-11-12 20:12:33.597721+09
\.


--
-- Data for Name: mission_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_definitions (id, origin, created_by_user_id, title, description, category_id, difficulty_id, estimated_duration_seconds, target_value, target_unit, verification_method, publication_status, deleted_at, created_at, updated_at, exercise_code, base_points, base_user_xp, base_pet_xp) FROM stdin;
d0000000-0000-4000-8000-000000000301	admin	\N	스쿼트 20회	무릎이 발끝을 넘지 않게 천천히	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	180	20.00	reps	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	squat	20	20	10
d0000000-0000-4000-8000-000000000302	admin	\N	푸시업 10회	몸을 일자로 유지해요	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	120	10.00	reps	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	push_up	20	20	10
d0000000-0000-4000-8000-000000000303	admin	\N	런지 20회	양쪽 다리를 번갈아 10회씩	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	180	20.00	reps	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	lunge	20	20	10
d0000000-0000-4000-8000-000000000304	admin	\N	버피 테스트 10회	엎드렸다 점프까지 한 번	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	180	10.00	reps	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	burpee	20	20	10
d0000000-0000-4000-8000-000000000305	admin	\N	플랭크 30초	허리가 처지지 않게 버텨요	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	60	30.00	seconds	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	plank	20	20	10
d0000000-0000-4000-8000-000000000306	admin	\N	러닝 2km	편한 속도로 달려요	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	900	2000.00	meters	sensor	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	running	20	20	10
d0000000-0000-4000-8000-000000000307	admin	\N	독서 20분	읽은 페이지를 사진으로 남겨요	d0000000-0000-4000-8000-000000000012	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1200	1.00	times	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	\N	10	10	5
d0000000-0000-4000-8000-000000000308	admin	\N	영단어 30개	외운 단어장을 사진으로 남겨요	d0000000-0000-4000-8000-000000000012	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1200	1.00	times	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	\N	10	10	5
d0000000-0000-4000-8000-000000000309	admin	\N	물 2L 마시기	마신 물병을 사진으로 남겨요	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	60	1.00	times	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	\N	10	10	5
d0000000-0000-4000-8000-000000000310	admin	\N	취침 전 스트레칭	스트레칭하는 모습을 사진으로	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	300	1.00	times	camera	public	\N	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	\N	10	10	5
8356e896-250e-460c-bcbe-05d001f08cd5	user	3a1a615d-da53-4098-b81c-168537d9c5e7	아침 스트레칭 5분	일어나서 가볍게 몸을 풀어요	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	300	5.00	minutes	camera	public	\N	2026-11-13 01:32:16.900522+09	2026-11-13 01:32:16.939038+09	\N	0	0	0
\.


--
-- Data for Name: mission_point_awards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_point_awards (mission_id, user_id, first_approved_result_id, original_points, paid_points, status, awarded_at, updated_at) FROM stdin;
13600eba-abb3-4336-81c6-600f64f70d0d	3a1a615d-da53-4098-b81c-168537d9c5e7	6e776fbc-1872-4ae3-a789-e0bbd49bea8d	20	20	active	2026-11-12 22:13:54.780597+09	2026-11-12 22:13:54.780597+09
b8dfabd4-fcd8-495f-8138-467300129b2f	644c7f97-852d-4339-97af-0e0deb46ac54	dad7414d-7a82-47d1-84f4-5638b5baf472	20	20	active	2026-11-13 01:32:19.302065+09	2026-11-13 01:32:19.302065+09
004d6b39-2372-4ac3-8bcf-8f2da9a99eed	644c7f97-852d-4339-97af-0e0deb46ac54	72c75e30-931e-4ad7-879f-3fbd4f0f4231	20	20	active	2026-11-13 01:32:19.404851+09	2026-11-13 01:32:19.404851+09
2f1cfbee-4245-4815-ace9-239a4bd02cdb	644c7f97-852d-4339-97af-0e0deb46ac54	fa36dcd0-0b68-4dea-9d55-b1e30cc0d2fa	20	20	active	2026-11-13 01:32:19.524537+09	2026-11-13 01:32:19.524537+09
f5fb5a30-423e-4cd8-af24-d569aaea8544	644c7f97-852d-4339-97af-0e0deb46ac54	07f95efb-ca7f-4af0-8b11-b14c62f1d54b	20	20	active	2026-11-13 01:32:19.655661+09	2026-11-13 01:32:19.655661+09
94657b05-ad70-4aee-abf7-ae2883bdd331	644c7f97-852d-4339-97af-0e0deb46ac54	4fe076e9-6798-4569-a441-48b3dcec43c5	20	20	active	2026-11-13 01:32:19.761194+09	2026-11-13 01:32:19.761194+09
f54a376a-6784-482c-9cdb-203df6894413	644c7f97-852d-4339-97af-0e0deb46ac54	fac762b7-7eef-432b-9060-f07a5b518c9f	20	20	active	2026-11-13 01:32:19.90753+09	2026-11-13 01:32:19.90753+09
5ddf1331-2d68-482b-80cf-f575076bc590	644c7f97-852d-4339-97af-0e0deb46ac54	619852da-20e4-4396-8af2-c987a56b1401	20	20	active	2026-11-13 01:32:20.050038+09	2026-11-13 01:32:20.050038+09
dab32a54-395a-41b3-a909-1a0e9573bfdb	b60ef6c5-f266-49ad-b850-21bd49a3916d	531b28da-4323-4cc5-b1d7-32be5791d89a	20	20	revoked	2026-11-13 01:32:20.550489+09	2026-11-13 01:32:20.615144+09
cd187669-fdbb-4498-bf15-d1400cd645df	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	2b67faef-0047-4495-88b4-0e75b3eb22da	20	20	active	2026-11-13 01:32:20.973576+09	2026-11-13 01:32:20.973576+09
65960e23-35c7-4eb8-9777-85c12cc04bea	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	0a22fb7b-a943-4cb8-8dc1-2216bc2fb11f	20	20	active	2026-11-13 01:32:21.156807+09	2026-11-13 01:32:21.156807+09
439ad5a3-1d36-4fc8-a1fd-5fa9492743be	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	df8563bf-1100-4f02-80d8-b4071d1277d6	20	20	active	2026-11-13 01:32:21.259333+09	2026-11-13 01:32:21.259333+09
31567496-c7cb-41e4-b0e0-f9e1b5684543	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	0fbe8d5f-cd0b-44c2-a24d-d22a494df19e	20	20	active	2026-11-13 01:32:21.360127+09	2026-11-13 01:32:21.360127+09
da3e831b-31d4-468e-8081-1f7de3622a71	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	5ea4ce03-7123-4702-bf3c-ae6e2d5c160d	20	20	active	2026-11-13 01:32:21.464338+09	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: mission_publication_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_publication_reviews (id, definition_id, requested_by_user_id, reviewed_by_admin_id, decision, reason, created_at) FROM stdin;
a6d0682f-844d-447f-8d4b-e92e1ce37c79	8356e896-250e-460c-bcbe-05d001f08cd5	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	submitted	\N	2026-11-13 01:32:16.91958+09
51cf1bcb-8bf8-4b40-93ef-af3c3c81ceb8	8356e896-250e-460c-bcbe-05d001f08cd5	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000001	approved	시연: 내용이 명확해 공개 승인	2026-11-13 01:32:16.939038+09
\.


--
-- Data for Name: mission_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points) FROM stdin;
dbf07b15-952b-480d-9fae-04adb78f6204	83529016-6360-4298-af8f-618abeacb9a7	3a1a615d-da53-4098-b81c-168537d9c5e7	1	\N	aborted	\N	2026-11-12 16:46:08.97061+09	\N	2026-11-12 16:49:00.25262+09	\N	\N	\N	0
66813fa4-eb36-41ff-a5d5-772496d87840	83529016-6360-4298-af8f-618abeacb9a7	3a1a615d-da53-4098-b81c-168537d9c5e7	2	1	review_required	camera_media	2026-11-12 19:54:31.954317+09	2026-11-12 19:55:16.390456+09	\N	{"appVersion": "0.1.0"}	\N	\N	0
cd5b37ee-61c2-4a98-a552-2ffa4ba2e3fe	94fce71f-58e7-4b7c-87cd-a8aa2dc7dbeb	3a1a615d-da53-4098-b81c-168537d9c5e7	1	1	review_required	camera_media	2026-11-12 19:57:36.531725+09	2026-11-12 19:58:11.977416+09	\N	{"appVersion": "0.1.0"}	\N	\N	0
05c6f57a-8f16-4ccf-bf3e-100e799c9749	bce6233d-72c7-4f36-90a3-6924d1dc2213	3a1a615d-da53-4098-b81c-168537d9c5e7	1	1	review_required	camera_media	2026-11-12 20:11:00.574221+09	2026-11-12 20:12:33.810046+09	\N	{"appVersion": "0.1.0", "videoDurationSeconds": 8}	\N	\N	0
65634f3c-84a5-440a-bf42-db6a717a2e2e	13600eba-abb3-4336-81c6-600f64f70d0d	3a1a615d-da53-4098-b81c-168537d9c5e7	1	1	approved	sensor_summary	2026-11-12 22:13:54.438612+09	2026-11-12 22:13:54.653315+09	2026-11-12 22:13:54.780597+09	{"rewards": {"petId": "8284b275-778f-45f4-81f0-5d12c87c5341", "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}, "distanceMeters": 2300, "durationSeconds": 960}	8284b275-778f-45f4-81f0-5d12c87c5341	1	500
51aed45c-b842-44d4-bb28-c6caa7064f3d	855dd32d-23c9-4555-9dc0-12cbe0c659a4	3a1a615d-da53-4098-b81c-168537d9c5e7	1	1	rejected	sensor_summary	2026-11-12 22:13:55.655584+09	2026-11-12 22:13:55.805361+09	2026-11-12 22:13:55.891063+09	{"distanceMeters": 1200, "durationSeconds": 960}	8284b275-778f-45f4-81f0-5d12c87c5341	1	500
59f80d77-30d0-4122-8ee6-b4f2e93314d5	9dec02ea-ac12-4e24-85cf-3f6f4bb8b84c	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	1	1	approved	sensor_summary	2026-11-06 01:32:18.250903+09	2026-11-06 01:32:18.280917+09	2026-11-06 01:32:18.303115+09	{"steps": 1}	\N	\N	0
84718825-134a-4e13-8186-01d0cd244e6a	590e911e-e4ba-495b-97f9-97a1e75121f1	29240605-e884-4515-bf20-783bb736f55a	1	1	approved	sensor_summary	2026-11-06 01:32:18.354563+09	2026-11-06 01:32:18.377037+09	2026-11-06 01:32:18.39453+09	{"steps": 1}	\N	\N	0
0576dd6f-f70a-4408-92e7-851958f4dec6	b60ad3f0-a3fd-469d-ac63-2d8b9476d17f	9c7af070-c543-4e0a-ba19-5dab3ceefad3	1	1	approved	sensor_summary	2026-11-06 01:32:18.435012+09	2026-11-06 01:32:18.455589+09	2026-11-06 01:32:18.472229+09	{"steps": 1}	\N	\N	0
367dfa7e-50bf-496a-8221-c10ee75ea68d	754944e9-0e62-4c28-ae6b-5ef8657bb96a	a45a1748-0674-4ebe-9b85-c0496143c495	1	1	approved	sensor_summary	2026-11-06 01:32:18.51167+09	2026-11-06 01:32:18.53419+09	2026-11-06 01:32:18.551755+09	{"steps": 1}	\N	\N	0
ea1c96c2-64c5-455e-9d60-69ce790f6b93	22b56590-a754-492f-97a4-88f618cd4ea9	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	1	1	approved	sensor_summary	2026-11-07 01:32:18.626414+09	2026-11-07 01:32:18.648386+09	2026-11-07 01:32:18.669586+09	{"steps": 1}	\N	\N	0
bad0252a-786b-438e-b8f1-3618f515fb14	4a340746-ebc2-465b-a461-54b685a81cbc	29240605-e884-4515-bf20-783bb736f55a	1	1	approved	sensor_summary	2026-11-07 01:32:18.711677+09	2026-11-07 01:32:18.738848+09	2026-11-07 01:32:18.756251+09	{"steps": 1}	\N	\N	0
d02f7e86-74ae-41f9-b75a-6b45921e1cbe	303c45bd-217b-4db4-bdba-9e222e35322d	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	1	1	approved	sensor_summary	2026-11-08 01:32:18.860213+09	2026-11-08 01:32:18.881097+09	2026-11-08 01:32:18.896608+09	{"steps": 1}	\N	\N	0
3557662f-2453-43be-9306-594e041ea972	b8dfabd4-fcd8-495f-8138-467300129b2f	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-07 01:32:19.267835+09	2026-11-07 01:32:19.286738+09	2026-11-07 01:32:19.302065+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	\N	\N	0
530195ae-e234-4bf8-b04e-3d45c7762370	004d6b39-2372-4ac3-8bcf-8f2da9a99eed	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-08 01:32:19.374048+09	2026-11-08 01:32:19.390865+09	2026-11-08 01:32:19.404851+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 2, "pointsCapped": false}}	\N	\N	0
a001c574-e3b4-49a7-82fd-e7f1e2c7d7da	2f1cfbee-4245-4815-ace9-239a4bd02cdb	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-09 01:32:19.480049+09	2026-11-09 01:32:19.50875+09	2026-11-09 01:32:19.524537+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 3, "pointsCapped": false}}	\N	\N	0
072cde38-7832-44aa-a390-1d6d636ae584	65960e23-35c7-4eb8-9777-85c12cc04bea	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	approved	sensor_summary	2026-11-13 01:32:21.113772+09	2026-11-13 01:32:21.139237+09	2026-11-13 01:32:21.156807+09	{"steps": 8000, "rewards": {"petId": "c58b94f5-9ecc-4fb2-bd5a-d33b5797dede", "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	500
b1298b1e-8105-4cfa-a6c1-2c880e8dbb64	f5fb5a30-423e-4cd8-af24-d569aaea8544	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-10 01:32:19.615266+09	2026-11-10 01:32:19.639431+09	2026-11-10 01:32:19.655661+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 4, "pointsCapped": false}}	\N	\N	0
d4a8c1f7-3cf4-41e5-bf7b-b973d88f4e95	f54a376a-6784-482c-9cdb-203df6894413	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-12 01:32:19.858504+09	2026-11-12 01:32:19.891794+09	2026-11-12 01:32:19.90753+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 6, "pointsCapped": false}}	\N	\N	0
bea3a7a2-187a-4d6d-8cba-152256e82d68	94657b05-ad70-4aee-abf7-ae2883bdd331	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-11 01:32:19.723954+09	2026-11-11 01:32:19.744666+09	2026-11-11 01:32:19.761194+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": true, "newBadges": [], "newLevelNo": 2, "petEvolved": false, "streakDays": 5, "pointsCapped": false}}	\N	\N	0
49cbb408-4390-468e-bcad-a9ac37a1dfc5	5ddf1331-2d68-482b-80cf-f575076bc590	644c7f97-852d-4339-97af-0e0deb46ac54	1	1	approved	sensor_summary	2026-11-13 01:32:19.997973+09	2026-11-13 01:32:20.022621+09	2026-11-13 01:32:20.050038+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [{"title": "7일 연속", "rarity": "rare", "achievementId": "d0000000-0000-4000-8000-000000000205", "badgeImageUrl": null}], "newLevelNo": null, "petEvolved": false, "streakDays": 7, "pointsCapped": false}}	\N	\N	0
51fd2acb-7af2-4a5d-846d-d0bd7cc248b7	dab32a54-395a-41b3-a909-1a0e9573bfdb	b60ef6c5-f266-49ad-b850-21bd49a3916d	1	1	rejected	sensor_summary	2026-11-13 01:32:20.508621+09	2026-11-13 01:32:20.532539+09	2026-11-13 01:32:20.615144+09	{"steps": 8000, "rewards": {"petId": null, "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	\N	\N	0
06a3b961-0a64-4521-8e2c-88a0624276e4	cd187669-fdbb-4498-bf15-d1400cd645df	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	approved	sensor_summary	2026-11-13 01:32:20.906007+09	2026-11-13 01:32:20.950521+09	2026-11-13 01:32:20.973576+09	{"steps": 8000, "rewards": {"petId": "c58b94f5-9ecc-4fb2-bd5a-d33b5797dede", "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	500
7a236fa2-c41f-4074-8069-5a6de9f23fe4	439ad5a3-1d36-4fc8-a1fd-5fa9492743be	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	approved	sensor_summary	2026-11-13 01:32:21.221136+09	2026-11-13 01:32:21.240231+09	2026-11-13 01:32:21.259333+09	{"steps": 8000, "rewards": {"petId": "c58b94f5-9ecc-4fb2-bd5a-d33b5797dede", "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	500
dcbddd64-78c0-4cb4-af8a-d7211e5e9888	31567496-c7cb-41e4-b0e0-f9e1b5684543	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	approved	sensor_summary	2026-11-13 01:32:21.325561+09	2026-11-13 01:32:21.34638+09	2026-11-13 01:32:21.360127+09	{"steps": 8000, "rewards": {"petId": "c58b94f5-9ecc-4fb2-bd5a-d33b5797dede", "petXp": 10, "points": 20, "userXp": 20, "levelUp": false, "newBadges": [], "newLevelNo": null, "petEvolved": false, "streakDays": 1, "pointsCapped": false}}	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	500
3632a9f8-ace5-4790-b466-5663b7e2afcf	da3e831b-31d4-468e-8081-1f7de3622a71	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	approved	sensor_summary	2026-11-13 01:32:21.42811+09	2026-11-13 01:32:21.448424+09	2026-11-13 01:32:21.464338+09	{"steps": 8000, "rewards": {"petId": "c58b94f5-9ecc-4fb2-bd5a-d33b5797dede", "petXp": 10, "points": 20, "userXp": 20, "levelUp": true, "newBadges": [], "newLevelNo": 2, "petEvolved": true, "streakDays": 1, "pointsCapped": false}}	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	500
\.


--
-- Data for Name: mission_reward_rate_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mission_reward_rate_versions (id, category_id, difficulty_id, version_no, points, effective_at, created_by_admin_id, created_at, user_xp, pet_xp) FROM stdin;
f9c6bd78-ed57-4f29-b70a-38e88f86509b	d0000000-0000-4000-8000-000000000011	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1	10	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	10	5
540bf9a6-7dff-4354-bfe5-5a64de1d7077	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	1	20	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	20	10
d577477e-ba0c-4ebe-9557-7e18599a769d	d0000000-0000-4000-8000-000000000011	c757fa32-d5ad-4a4d-8450-2bf62c97f02f	1	30	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	30	15
c62b1426-5a8e-4c5a-996d-ebefb61c9813	d0000000-0000-4000-8000-000000000012	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1	10	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	10	5
177b5b41-47fd-4ddc-93f3-cd30ca782a57	d0000000-0000-4000-8000-000000000012	539a153f-647e-4103-b0eb-bc9c20b0b947	1	20	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	20	10
6444750c-b085-426c-9f39-7cc5e77da619	d0000000-0000-4000-8000-000000000012	c757fa32-d5ad-4a4d-8450-2bf62c97f02f	1	30	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	30	15
b61c2a6b-0112-43fd-8710-793b08a1e81e	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1	10	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	10	5
c60a5bf9-ca66-4f6e-acb8-e4c7c8754b18	d0000000-0000-4000-8000-000000000013	539a153f-647e-4103-b0eb-bc9c20b0b947	1	20	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	20	10
1b74ead2-1e19-4f1a-ade0-04624e32d1ff	d0000000-0000-4000-8000-000000000013	c757fa32-d5ad-4a4d-8450-2bf62c97f02f	1	30	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	30	15
\.


--
-- Data for Name: missions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp) FROM stdin;
481072b5-08db-4ba3-a9ea-98f2dfa48dde	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86dd6a18-8f6c-496c-bf76-ebe6b4fff794	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 1번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-13	2026-11-14 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
11823f0f-e053-4dbc-a0e7-8c1cd417af20	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86dd6a18-8f6c-496c-bf76-ebe6b4fff794	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 2번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-16	2026-11-17 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
16470202-94e5-4659-8a39-26b3cde819ab	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86dd6a18-8f6c-496c-bf76-ebe6b4fff794	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 3번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-18	2026-11-19 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
e538aef0-080d-4c28-875b-a3bb5eecd58d	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	f1bbacc1-fa12-49ec-be2b-cfa59a3711f8	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 4번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-21	2026-11-22 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
09e3fc43-1cd5-40f8-a631-56c19d1fc110	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	f1bbacc1-fa12-49ec-be2b-cfa59a3711f8	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 5번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-24	2026-11-25 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
8e62d25b-4903-4bf2-aee2-ed7af09e3beb	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	f1bbacc1-fa12-49ec-be2b-cfa59a3711f8	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 6번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-26	2026-11-27 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
ee6664ce-5a9b-415b-bac6-36eac00de325	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	95a74e75-c52c-4d9e-ac7f-2fd5efcb2dd2	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 7번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-11-29	2026-11-30 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
b0075c7c-e26f-48cf-b5ff-3a8fc2235a2e	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	95a74e75-c52c-4d9e-ac7f-2fd5efcb2dd2	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 8번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-12-02	2026-12-03 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
34e9c8ee-f9c2-48c8-afcf-0fe4541bebc2	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	95a74e75-c52c-4d9e-ac7f-2fd5efcb2dd2	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 9번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-12-04	2026-12-05 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
cbca7219-9cf9-4531-b354-49136cb298a9	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86d726a4-4a8d-48bc-a656-5dd13136f699	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 10번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-12-07	2026-12-08 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
2c10437b-fd43-44fc-ba1a-7bd63e4c9f5a	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86d726a4-4a8d-48bc-a656-5dd13136f699	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 11번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-12-09	2026-12-10 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
6a2a09ba-17a4-4fec-93b1-66e77f6ce448	3a1a615d-da53-4098-b81c-168537d9c5e7	827608c0-60a2-4f85-ab99-58dbe4a1325c	86d726a4-4a8d-48bc-a656-5dd13136f699	\N	6a92d9da-9595-455c-85f3-0419705ed532	ai	Squat50inamonth 12번째	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	1800	camera	2026-12-11	2026-12-12 00:00:00+09	t	scheduled	\N	\N	\N	\N	2026-11-12 16:41:46.033507+09	2026-11-12 16:41:46.033507+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
83529016-6360-4298-af8f-618abeacb9a7	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	d0000000-0000-4000-8000-000000000309	\N	template	물 2L 마시기	마신 물병을 사진으로 남겨요	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1.00	times	60	camera	2026-11-12	2026-11-13 00:00:00+09	t	submitted	\N	\N	\N	\N	2026-11-12 16:43:44.27783+09	2026-11-12 19:55:16.390456+09	\N	10	\N	10	5
94fce71f-58e7-4b7c-87cd-a8aa2dc7dbeb	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	d0000000-0000-4000-8000-000000000310	\N	template	취침 전 스트레칭	스트레칭하는 모습을 사진으로	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	1.00	times	300	camera	2026-11-12	2026-11-13 00:00:00+09	t	submitted	\N	\N	\N	\N	2026-11-12 19:56:59.704081+09	2026-11-12 19:58:11.977416+09	\N	10	\N	10	5
bce6233d-72c7-4f36-90a3-6924d1dc2213	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	d0000000-0000-4000-8000-000000000304	\N	template	버피 테스트 10회	엎드렸다 점프까지 한 번	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	10.00	reps	180	camera	2026-11-12	2026-11-13 00:00:00+09	t	submitted	\N	\N	\N	\N	2026-11-12 20:10:06.416054+09	2026-11-12 20:12:33.810046+09	burpee	20	\N	20	10
7f7cc33c-80c2-4012-bd1f-53d99f341f83	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	user	FormTest20	\N	d0000000-0000-4000-8000-000000000013	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	5.00	times	\N	camera	2026-11-12	2026-11-13 00:00:00+09	t	cancelled	\N	user_cancelled	2026-11-12 22:08:46.05859+09	\N	2026-11-12 22:02:42.072597+09	2026-11-12 22:08:46.05859+09	\N	10	b61c2a6b-0112-43fd-8710-793b08a1e81e	10	5
0a403234-a859-4426-b597-d050e1169997	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	user	StaleCheck	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	\N	camera	2026-11-12	2026-11-13 00:00:00+09	t	cancelled	\N	user_cancelled	2026-11-12 22:08:53.873581+09	\N	2026-11-12 22:06:38.972849+09	2026-11-12 22:08:53.873581+09	push_up	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
381d02d6-c54c-4b53-9616-2c48651eba40	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	user	App2	\N	d0000000-0000-4000-8000-000000000011	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	20.00	times	\N	camera	2026-11-14	2026-11-15 00:00:00+09	t	cancelled	\N	user_cancelled	2026-11-12 22:08:58.083356+09	\N	2026-11-12 21:12:57.662619+09	2026-11-12 22:08:58.083356+09	push_up	10	f9c6bd78-ed57-4f29-b70a-38e88f86509b	10	5
12a5014a-d72b-433b-ba77-5999cd7a92e5	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	user	App3	\N	d0000000-0000-4000-8000-000000000011	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	20.00	times	\N	camera	2026-11-14	2026-11-15 00:00:00+09	t	cancelled	\N	user_cancelled	2026-11-12 22:09:00.877473+09	\N	2026-11-12 21:12:58.042754+09	2026-11-12 22:09:00.877473+09	push_up	10	f9c6bd78-ed57-4f29-b70a-38e88f86509b	10	5
aa70548e-ca36-49af-8530-e62eae034cce	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	user	AppShape	\N	d0000000-0000-4000-8000-000000000011	34a1e4a7-3e8f-4f51-92f3-c2fb91b89262	20.00	times	\N	camera	2026-11-15	2026-11-16 00:00:00+09	t	cancelled	\N	user_cancelled	2026-11-12 22:09:06.20687+09	\N	2026-11-12 21:35:38.034097+09	2026-11-12 22:09:06.20687+09	push_up	10	f9c6bd78-ed57-4f29-b70a-38e88f86509b	10	5
13600eba-abb3-4336-81c6-600f64f70d0d	3a1a615d-da53-4098-b81c-168537d9c5e7	ced49867-b656-4b4f-a745-aa195b6ac979	\N	\N	\N	user	러닝 2km	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	2000.00	meters	\N	sensor	2026-11-12	2026-11-13 00:00:00+09	t	completed	\N	\N	\N	\N	2026-11-12 22:13:53.913044+09	2026-11-12 22:13:54.780597+09	running	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
627505ef-1250-48c3-8f83-05d526f2d380	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-14	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
63715946-6900-419e-954e-0ed719261f0c	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-15	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
cfca58fc-6a21-4560-b86d-5d99f0299a3d	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-16	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
490e312f-fa9d-4fa1-9a6f-a01b7a1ff4ed	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-17	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
456a0f01-850c-4565-97e0-7c8b574e114a	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-18	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
c8fcb1b6-9a80-4bad-b9bd-e2df24856cac	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-19	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
5bb70897-f1bd-427f-aa19-03071a70c124	3a1a615d-da53-4098-b81c-168537d9c5e7	\N	\N	\N	\N	challenge	7일 스쿼트 챌린지(시연) 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	180	camera	2026-11-20	\N	t	scheduled	\N	\N	\N	\N	2026-11-12 22:16:00.595325+09	2026-11-12 22:16:00.595325+09	squat	0	\N	0	0
855dd32d-23c9-4555-9dc0-12cbe0c659a4	3a1a615d-da53-4098-b81c-168537d9c5e7	ced49867-b656-4b4f-a745-aa195b6ac979	\N	\N	\N	user	러닝 3km	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	3000.00	meters	\N	sensor	2026-11-12	2026-11-13 00:00:00+09	t	failed	\N	\N	\N	\N	2026-11-12 22:13:54.151357+09	2026-11-13 00:02:59.461345+09	running	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
b28bf2c6-cd05-47a8-8a0a-bd1dcaf15b8f	3a1a615d-da53-4098-b81c-168537d9c5e7	ced49867-b656-4b4f-a745-aa195b6ac979	\N	\N	\N	user	스쿼트 20개	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	20.00	reps	\N	camera	2026-11-12	2026-11-13 00:00:00+09	t	failed	\N	\N	\N	\N	2026-11-12 22:13:54.301291+09	2026-11-13 00:02:59.538809+09	squat	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
5a8005e8-542d-42ad-a78d-b3c2c6ec2ad4	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.028639+09	running	0	\N	0	0
2d72ed28-8acd-4da2-9c30-4cfdd624bc43	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.028639+09	running	0	\N	0	0
9dec02ea-ac12-4e24-85cf-3f6f4bb8b84c	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-06	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.303115+09	running	0	\N	0	0
22b56590-a754-492f-97a4-88f618cd4ea9	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.669586+09	running	0	\N	0	0
303c45bd-217b-4db4-bdba-9e222e35322d	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.896608+09	running	0	\N	0	0
d62a0920-8fb2-43af-8625-88676dd557ad	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.028639+09	running	0	\N	0	0
c475627e-2aa0-4eda-ae61-22830afd1c01	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	\N	\N	\N	\N	challenge	시연 정산 챌린지 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.028639+09	2026-11-13 01:32:18.028639+09	running	0	\N	0	0
0797f874-d83f-4080-8ca5-07d2338a1213	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.073437+09	running	0	\N	0	0
7325235f-3871-415e-9898-bb8a1df3fd38	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.073437+09	running	0	\N	0	0
a7168113-90d4-4bbe-b513-f2b96c1a4495	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.073437+09	running	0	\N	0	0
2b387333-1e7f-4266-b65a-9a81e740ba82	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.073437+09	running	0	\N	0	0
4a340746-ebc2-465b-a461-54b685a81cbc	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.756251+09	running	0	\N	0	0
031c3078-fe65-4b4d-beb3-640d79e92ba7	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.073437+09	running	0	\N	0	0
ef122263-8c29-4c72-96d6-12b6efd32c1f	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
439c25ae-6b79-4099-81ae-8fecdc67e1af	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
fcb9f414-19fa-4861-951b-f4f7a5ed7ecd	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
281e4894-a0e4-4a80-b29d-9c703fedd340	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
bce3f6ea-02b9-4857-839d-7d3d951cd942	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
ee355c02-01bd-4d9a-aa29-08fc4723cc94	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.123276+09	running	0	\N	0	0
6c9147b1-ec7c-4d3b-ad12-76e56a5d242f	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-06	\N	t	scheduled	\N	\N	\N	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.158427+09	running	0	\N	0	0
590e911e-e4ba-495b-97f9-97a1e75121f1	29240605-e884-4515-bf20-783bb736f55a	\N	\N	\N	\N	challenge	시연 정산 챌린지 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-06	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.073437+09	2026-11-13 01:32:18.39453+09	running	0	\N	0	0
b60ad3f0-a3fd-469d-ac63-2d8b9476d17f	9c7af070-c543-4e0a-ba19-5dab3ceefad3	\N	\N	\N	\N	challenge	시연 정산 챌린지 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-06	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.123276+09	2026-11-13 01:32:18.472229+09	running	0	\N	0	0
754944e9-0e62-4c28-ae6b-5ef8657bb96a	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 1일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-06	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.551755+09	running	0	\N	0	0
55c6c9ed-2d37-455c-9403-4080f1f49dcd	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
475a19a5-efb4-473e-af0d-99660dc50f1b	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
c7988fc2-3632-4002-83ca-5404da490706	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
b330a152-82d0-4c21-ad98-ba167b004170	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
5bac238b-5c01-49f8-bb3a-2008f122ee6a	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
07dde0fe-a210-43ef-b17e-88fea298eec8	ef98fa2f-8486-4767-b11e-d00e5948cfd2	\N	\N	\N	\N	challenge	시연 정산 챌린지 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	cancelled	\N	challenge_withdrawn	2026-11-13 01:32:18.793098+09	\N	2026-11-13 01:32:18.158427+09	2026-11-13 01:32:18.793098+09	running	0	\N	0	0
a737ee5c-3ad7-4e6f-a47b-ee9e4f15f8d6	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 2일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
8d051bb1-daab-4a08-ad50-174613dc3157	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 3일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
addd2ad3-2e47-4c0e-a77d-e2e25fe8744c	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 4일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
57511d33-f052-4fe2-b2cc-4cfa96250959	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 5일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
7a2406be-4f2a-44db-a27d-c9cecdce338d	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 6일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
b2b221a4-e40c-43b3-9c31-a3e468784878	a45a1748-0674-4ebe-9b85-c0496143c495	\N	\N	\N	\N	challenge	시연 정산 챌린지 7일차	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	cancelled	\N	challenge_disqualified	2026-11-13 01:32:18.811299+09	\N	2026-11-13 01:32:18.192563+09	2026-11-13 01:32:18.811299+09	running	0	\N	0	0
b8dfabd4-fcd8-495f-8138-467300129b2f	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-07	\N	t	completed	\N	\N	\N	\N	2026-11-07 01:32:19.25368+09	2026-11-07 01:32:19.302065+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
004d6b39-2372-4ac3-8bcf-8f2da9a99eed	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-08	\N	t	completed	\N	\N	\N	\N	2026-11-08 01:32:19.366176+09	2026-11-08 01:32:19.404851+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
2f1cfbee-4245-4815-ace9-239a4bd02cdb	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-09	\N	t	completed	\N	\N	\N	\N	2026-11-09 01:32:19.466124+09	2026-11-09 01:32:19.524537+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
f5fb5a30-423e-4cd8-af24-d569aaea8544	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-10	\N	t	completed	\N	\N	\N	\N	2026-11-10 01:32:19.59709+09	2026-11-10 01:32:19.655661+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
94657b05-ad70-4aee-abf7-ae2883bdd331	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-11	\N	t	completed	\N	\N	\N	\N	2026-11-11 01:32:19.714604+09	2026-11-11 01:32:19.761194+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
f54a376a-6784-482c-9cdb-203df6894413	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-12	\N	t	completed	\N	\N	\N	\N	2026-11-12 01:32:19.845567+09	2026-11-12 01:32:19.90753+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
5ddf1331-2d68-482b-80cf-f575076bc590	644c7f97-852d-4339-97af-0e0deb46ac54	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:19.97402+09	2026-11-13 01:32:20.050038+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
dab32a54-395a-41b3-a909-1a0e9573bfdb	b60ef6c5-f266-49ad-b850-21bd49a3916d	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	in_progress	\N	\N	\N	\N	2026-11-13 01:32:20.495748+09	2026-11-13 01:32:20.615144+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
cd187669-fdbb-4498-bf15-d1400cd645df	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:20.892947+09	2026-11-13 01:32:20.973576+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
65960e23-35c7-4eb8-9777-85c12cc04bea	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:21.100167+09	2026-11-13 01:32:21.156807+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
439ad5a3-1d36-4fc8-a1fd-5fa9492743be	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:21.21091+09	2026-11-13 01:32:21.259333+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
31567496-c7cb-41e4-b0e0-f9e1b5684543	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:21.316874+09	2026-11-13 01:32:21.360127+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
da3e831b-31d4-468e-8081-1f7de3622a71	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	\N	\N	\N	\N	user	시연 미션	\N	d0000000-0000-4000-8000-000000000011	539a153f-647e-4103-b0eb-bc9c20b0b947	\N	\N	\N	sensor	2026-11-13	\N	t	completed	\N	\N	\N	\N	2026-11-13 01:32:21.417572+09	2026-11-13 01:32:21.464338+09	\N	20	540bf9a6-7dff-4354-bfe5-5a64de1d7077	20	10
\.


--
-- Data for Name: notice_recipients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notice_recipients (notice_id, audience_type, user_id) FROM stdin;
9ccf005a-fc4d-47ba-b4f8-f3c7319600e6	users	3a1a615d-da53-4098-b81c-168537d9c5e7
\.


--
-- Data for Name: notices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notices (id, category, title, body, link_screen, audience_type, show_in_list, send_push, policy_document_version_id, status, scheduled_at, published_at, fanout_completed_at, cancelled_at, created_by_admin_id, created_at, updated_at) FROM stdin;
9ccf005a-fc4d-47ba-b4f8-f3c7319600e6	service	시연 공지: D-World에 오신 걸 환영해요	오늘의 미션을 확인하고 펫과 함께 성장해 보세요.	\N	users	t	t	\N	published	\N	2026-11-12 22:16:01.03664+09	2026-11-12 22:16:01.03664+09	\N	d0000000-0000-4000-8000-000000000001	2026-11-12 22:16:00.907382+09	2026-11-12 22:16:01.03664+09
\.


--
-- Data for Name: pending_pet_experience; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_pet_experience (experience_award_id, user_id, base_pet_xp, status, assigned_pet_id, created_at, assigned_at) FROM stdin;
4a65e9f6-a1c9-467c-8816-950f938c94e4	29240605-e884-4515-bf20-783bb736f55a	60	pending	\N	2026-11-13 01:32:19.063903+09	\N
ee719ab2-e1d3-48eb-bba8-7abb4a4f463b	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.302065+09	\N
9153fad3-1ef7-4f9f-af1d-4f2e62e526f4	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.404851+09	\N
e5ab81bc-77f8-4063-800b-e222a1c6e25b	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.524537+09	\N
09b4d531-47c7-4ec4-a793-f64087403964	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.655661+09	\N
5f6cafa4-2cdf-44ca-af24-23c50f6af17c	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.761194+09	\N
888dd7a5-eb7f-461e-b740-14d3d244695d	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:19.90753+09	\N
38f1cbf4-e1ef-40fc-b286-58d31588d811	644c7f97-852d-4339-97af-0e0deb46ac54	10	pending	\N	2026-11-13 01:32:20.050038+09	\N
4b0c356f-928c-4bf3-ba53-f6a193f76b41	b60ef6c5-f266-49ad-b850-21bd49a3916d	10	cancelled	\N	2026-11-13 01:32:20.550489+09	\N
\.


--
-- Data for Name: pet_evolution_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_evolution_events (id, user_pet_id, from_stage_no, to_stage_no, total_xp_after, reason, occurred_at) FROM stdin;
97dfb99c-72ea-4078-a9f9-b2b5aef0166e	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	1	2	50	growth	2026-11-13 01:32:21.498391+09
\.


--
-- Data for Name: pet_level_policy_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_level_policy_versions (id, version_no, effective_at, created_by_admin_id, created_at) FROM stdin;
f4de1036-6c05-45ba-987b-cb7dc6bdf437	1	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
\.


--
-- Data for Name: pet_level_thresholds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_level_thresholds (policy_version_id, level_no, min_total_xp) FROM stdin;
f4de1036-6c05-45ba-987b-cb7dc6bdf437	1	0
f4de1036-6c05-45ba-987b-cb7dc6bdf437	2	100
f4de1036-6c05-45ba-987b-cb7dc6bdf437	3	300
f4de1036-6c05-45ba-987b-cb7dc6bdf437	4	600
f4de1036-6c05-45ba-987b-cb7dc6bdf437	5	1000
f4de1036-6c05-45ba-987b-cb7dc6bdf437	6	1500
f4de1036-6c05-45ba-987b-cb7dc6bdf437	7	2100
f4de1036-6c05-45ba-987b-cb7dc6bdf437	8	2800
f4de1036-6c05-45ba-987b-cb7dc6bdf437	9	3600
f4de1036-6c05-45ba-987b-cb7dc6bdf437	10	4500
\.


--
-- Data for Name: pet_species; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_species (id, code, name, description, status, created_by_admin_id, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000101	steady_cat	꾸준냥이	운동을 좋아하는 고양이	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000102	book_owl	책벌레 부엉이	공부를 좋아하는 부엉이	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000103	sprout	새싹이	좋은 습관을 좋아하는 새싹	public	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: pet_species_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_species_versions (id, species_id, version_no, name, description, personality, world_text, category_id, unlock_condition_type, unlock_target_count, unlock_category_id, unlock_achievement_id, hatch_mission_count, effective_at, created_by_admin_id, created_at) FROM stdin;
d0000000-0000-4000-8000-000000000111	d0000000-0000-4000-8000-000000000101	1	꾸준냥이	운동 미션을 하면 빨리 자라요	활발하고 끈기 있음	운동장 옆 작은 마을에 살아요	d0000000-0000-4000-8000-000000000011	none	\N	\N	\N	3	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000112	d0000000-0000-4000-8000-000000000102	1	책벌레 부엉이	학습 미션을 하면 빨리 자라요	차분하고 호기심 많음	오래된 도서관 꼭대기에 살아요	d0000000-0000-4000-8000-000000000012	none	\N	\N	\N	3	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000113	d0000000-0000-4000-8000-000000000103	1	새싹이	생활습관 미션을 하면 빨리 자라요	느긋하고 다정함	햇살 좋은 정원에 살아요	d0000000-0000-4000-8000-000000000013	none	\N	\N	\N	3	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: pet_stage_dialogues; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_stage_dialogues (species_version_id, stage_no, dialogue_no, text_content, time_of_day, situation_code, display_order) FROM stdin;
d0000000-0000-4000-8000-000000000111	1	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000111	2	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000111	3	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000111	1	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000111	2	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000111	3	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000112	1	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000112	2	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000112	3	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000112	1	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000112	2	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000112	3	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000113	1	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000113	2	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000113	3	1	좋은 아침! 오늘도 같이 해 볼까?	morning	\N	1
d0000000-0000-4000-8000-000000000113	1	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000113	2	2	오늘 하루도 수고했어!	evening	\N	2
d0000000-0000-4000-8000-000000000113	3	2	오늘 하루도 수고했어!	evening	\N	2
\.


--
-- Data for Name: pet_stage_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_stage_images (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id, created_at) FROM stdin;
d0000000-0000-4000-8000-000000000121	d0000000-0000-4000-8000-000000000101	dev/assets/pets/d0000000-0000-4000-8000-000000000101/egg-d0000000-0000-4000-8000-000000000121.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000122	d0000000-0000-4000-8000-000000000101	dev/assets/pets/d0000000-0000-4000-8000-000000000101/baby-d0000000-0000-4000-8000-000000000122.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000123	d0000000-0000-4000-8000-000000000101	dev/assets/pets/d0000000-0000-4000-8000-000000000101/adult-d0000000-0000-4000-8000-000000000123.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000124	d0000000-0000-4000-8000-000000000102	dev/assets/pets/d0000000-0000-4000-8000-000000000102/egg-d0000000-0000-4000-8000-000000000124.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000125	d0000000-0000-4000-8000-000000000102	dev/assets/pets/d0000000-0000-4000-8000-000000000102/baby-d0000000-0000-4000-8000-000000000125.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000126	d0000000-0000-4000-8000-000000000102	dev/assets/pets/d0000000-0000-4000-8000-000000000102/adult-d0000000-0000-4000-8000-000000000126.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000127	d0000000-0000-4000-8000-000000000103	dev/assets/pets/d0000000-0000-4000-8000-000000000103/egg-d0000000-0000-4000-8000-000000000127.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000128	d0000000-0000-4000-8000-000000000103	dev/assets/pets/d0000000-0000-4000-8000-000000000103/baby-d0000000-0000-4000-8000-000000000128.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000129	d0000000-0000-4000-8000-000000000103	dev/assets/pets/d0000000-0000-4000-8000-000000000103/adult-d0000000-0000-4000-8000-000000000129.png	image/png	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: pet_stage_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pet_stage_versions (species_version_id, species_id, stage_no, stage_code, min_total_xp, bonus_basis_points, image_id) FROM stdin;
d0000000-0000-4000-8000-000000000111	d0000000-0000-4000-8000-000000000101	1	egg	0	500	d0000000-0000-4000-8000-000000000121
d0000000-0000-4000-8000-000000000111	d0000000-0000-4000-8000-000000000101	2	baby	50	1000	d0000000-0000-4000-8000-000000000122
d0000000-0000-4000-8000-000000000111	d0000000-0000-4000-8000-000000000101	3	adult	200	1500	d0000000-0000-4000-8000-000000000123
d0000000-0000-4000-8000-000000000112	d0000000-0000-4000-8000-000000000102	1	egg	0	500	d0000000-0000-4000-8000-000000000124
d0000000-0000-4000-8000-000000000112	d0000000-0000-4000-8000-000000000102	2	baby	50	1000	d0000000-0000-4000-8000-000000000125
d0000000-0000-4000-8000-000000000112	d0000000-0000-4000-8000-000000000102	3	adult	200	1500	d0000000-0000-4000-8000-000000000126
d0000000-0000-4000-8000-000000000113	d0000000-0000-4000-8000-000000000103	1	egg	0	500	d0000000-0000-4000-8000-000000000127
d0000000-0000-4000-8000-000000000113	d0000000-0000-4000-8000-000000000103	2	baby	50	1000	d0000000-0000-4000-8000-000000000128
d0000000-0000-4000-8000-000000000113	d0000000-0000-4000-8000-000000000103	3	adult	200	1500	d0000000-0000-4000-8000-000000000129
\.


--
-- Data for Name: phone_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.phone_credentials (user_id, phone_e164, password_hash, verified_at, password_changed_at, failed_attempt_count, locked_until) FROM stdin;
d0000000-0000-4000-8000-000000000601	+821000000001	$argon2id$v=19$m=65536,p=4,t=3$kpz2ByyR8t6n3MnH+LlRUQ$QOjlo3RCwlLqeutNDxsTDJxw0Mqk58hAqnQh9YE1Ng0	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09	1	\N
3a1a615d-da53-4098-b81c-168537d9c5e7	+821099999999	$argon2id$v=19$m=65536,p=4,t=3$id3fD514zoNrdf8da1ln/A$PXhADQPwMzq5SeK3aH+bT1i+bkrpCXcXgKQRp1ArwwU	2026-11-12 16:25:02.306978+09	2026-11-12 22:23:50.26424+09	0	\N
389e1d24-ebcf-4081-898b-e9489d21d682	+821011110001	$argon2id$v=19$m=65536,p=4,t=3$twp+eIpb3b9w/g9v+e5wTw$REZyZVOAOHa3HUqq7KuYf/JfUlA+g8+nLL9vWIKEYQk	2026-11-13 01:32:16.60814+09	2026-11-13 01:32:16.60814+09	0	\N
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	+821011110002	$argon2id$v=19$m=65536,p=4,t=3$4Anx8Gpa+ncZ/g+g8dUAmQ$qnNdgKqUnfnME6GagmsmyTCtZlPklCHBI+oZUeT+qNY	2026-11-13 01:32:16.791076+09	2026-11-13 01:32:16.791076+09	0	\N
ad2ee538-8b45-4a7d-af16-84eba6f995e4	+821011110003	$argon2id$v=19$m=65536,p=4,t=3$9vEp1UmmLO7rvdVDfJwZLQ$ETFZdhR9Rd5JWckyQ8nf7cSjp8Pay1nxFDQDY1BkInw	2026-11-13 01:32:17.199237+09	2026-11-13 01:32:17.199237+09	0	\N
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	+821011110100	$argon2id$v=19$m=65536,p=4,t=3$PO1oIilyDFTKdtSPs2oDbw$P8nbyBrKptChIzfjJGRMFWyXIHgJHQ9PIXrYyuFa0X8	2026-11-13 01:32:17.497324+09	2026-11-13 01:32:17.497324+09	0	\N
29240605-e884-4515-bf20-783bb736f55a	+821011110101	$argon2id$v=19$m=65536,p=4,t=3$/LsMOzztVsBqJBqf61iqsw$EtjpJKfb9EER0ygrf7D96uWs/lMOB4cM24x/N1JSnX0	2026-11-13 01:32:17.598587+09	2026-11-13 01:32:17.598587+09	0	\N
9c7af070-c543-4e0a-ba19-5dab3ceefad3	+821011110102	$argon2id$v=19$m=65536,p=4,t=3$bJpaAxlDyJ+CXw5zYO0ROA$3MnpfSOGowWCOigzmkDkNtr7sDZpS01ps923h89E+Ls	2026-11-13 01:32:17.713912+09	2026-11-13 01:32:17.713912+09	0	\N
ef98fa2f-8486-4767-b11e-d00e5948cfd2	+821011110103	$argon2id$v=19$m=65536,p=4,t=3$V5gSsMqJBHzRfdUGTeQy8w$5viN/J5p7K2+9OxfgEIwUAlJQG5pzF9eAjqMbebtFlc	2026-11-13 01:32:17.846956+09	2026-11-13 01:32:17.846956+09	0	\N
a45a1748-0674-4ebe-9b85-c0496143c495	+821011110104	$argon2id$v=19$m=65536,p=4,t=3$cywP5kGkh9hd4mz4i6nYRw$xGDZRl2Oq5yvfrWEU0vBCpvkAlytuEk/yzD+PCBkmh4	2026-11-13 01:32:18.003838+09	2026-11-13 01:32:18.003838+09	0	\N
644c7f97-852d-4339-97af-0e0deb46ac54	+821011110004	$argon2id$v=19$m=65536,p=4,t=3$AY+MX/SHjrdHkrdtX7uNFQ$avxUUyXPTAmoxMMcRQNk0y3+hlDBw9d2XeYo+GGgG2g	2026-11-13 01:32:19.239128+09	2026-11-13 01:32:19.239128+09	0	\N
b60ef6c5-f266-49ad-b850-21bd49a3916d	+821011110005	$argon2id$v=19$m=65536,p=4,t=3$CuNQZUnTMyBNCE+2kl8MVg$wLuJxaseK7RdbMdGPGq67NMklrrsqmHtOT0dIGMSddI	2026-11-13 01:32:20.47098+09	2026-11-13 01:32:20.47098+09	0	\N
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	+821011110006	$argon2id$v=19$m=65536,p=4,t=3$DNwh1I07k5Ud7hRF8zCmeA$60L2jQ/IJJ+UnEbUb37ZIwPgN/5xiuA/nEXPIhDKdvo	2026-11-13 01:32:20.806656+09	2026-11-13 01:32:20.806656+09	0	\N
\.


--
-- Data for Name: plan_adjustment_proposals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_adjustment_proposals (id, run_id, run_type, user_id, goal_id, status, proposal_json, accepted_plan_json, created_at, expires_at, decided_at, before_plan, reason) FROM stdin;
c216ea53-441b-40f9-a2c9-7c24cd06d0db	9efa5c23-17ec-4c88-a560-b654aea55a97	plan_adjustment	3a1a615d-da53-4098-b81c-168537d9c5e7	ced49867-b656-4b4f-a745-aa195b6ac979	proposed	{"steps": [{"title": "가볍게 다시 시작", "stepNo": 1, "dueDate": "2026-11-20", "missions": [{"title": "스쿼트 10개", "isRequired": true, "targetUnit": "reps", "description": null, "targetValue": 10, "categoryCode": "exercise", "exerciseCode": "squat", "scheduledDate": "2026-11-16", "difficultyCode": "normal", "verificationMethod": "camera", "estimatedDurationSeconds": 300}], "description": null}]}	\N	2026-11-13 01:32:17.065433+09	2026-11-20 01:32:17.065433+09	\N	{"steps": []}	지난주 달성률이 낮아 이번 주 목표를 가볍게 낮춰 봤어요.
\.


--
-- Data for Name: point_monthly_cap_policies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_monthly_cap_policies (id, effective_month, monthly_limit_points, created_by_admin_id, created_at) FROM stdin;
00000000-0000-0000-0000-000000000004	2026-11-01	100000	\N	2026-11-09 20:23:11.927855+09
\.


--
-- Data for Name: point_monthly_usage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_monthly_usage (user_id, month_start_date, gross_auto_awarded_points, same_month_recovered_points, updated_at) FROM stdin;
3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-01	120	0	2026-11-12 22:13:56.295155+09
29240605-e884-4515-bf20-783bb736f55a	2026-11-01	300	0	2026-11-13 01:32:19.063903+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-01	210	0	2026-11-13 01:32:20.050038+09
b60ef6c5-f266-49ad-b850-21bd49a3916d	2026-11-01	20	6	2026-11-13 01:32:20.615144+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	2026-11-01	100	0	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: point_recovery_claims; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_recovery_claims (id, user_id, mission_id, original_award_transaction_id, target_points, outstanding_points, settled_points, is_cancelled, created_at, cancelled_at, challenge_reward_grant_id, streak_milestone_award_id, user_achievement_id) FROM stdin;
6034c336-123b-408b-b64c-41bbc2495a81	b60ef6c5-f266-49ad-b850-21bd49a3916d	dab32a54-395a-41b3-a909-1a0e9573bfdb	0d07befb-2a9d-42b4-90fa-33ab014940f8	14	14	0	f	2026-11-13 01:32:20.615144+09	\N	\N	\N	\N
\.


--
-- Data for Name: point_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_transactions (id, user_id, kind, available_delta, outstanding_delta, balance_after, outstanding_after, source_type, source_id, original_transaction_id, recovery_claim_id, cap_month, cap_delta, idempotency_key, created_by_admin_id, reason, occurred_at) FROM stdin;
189f4bb7-9edb-4ad1-945b-55770421641d	3a1a615d-da53-4098-b81c-168537d9c5e7	auto_award	20	0	20	0	mission	13600eba-abb3-4336-81c6-600f64f70d0d	\N	\N	2026-11-01	20	mission:award:13600eba-abb3-4336-81c6-600f64f70d0d	\N	\N	2026-11-12 22:13:54.780597+09
5a41391e-4322-4521-8bfb-f666d9b96905	3a1a615d-da53-4098-b81c-168537d9c5e7	auto_award	100	0	120	0	achievement	37fa1f67-5ea2-4e86-bdcd-d1174981e219	\N	\N	2026-11-01	100	achievement:award:37fa1f67-5ea2-4e86-bdcd-d1174981e219	\N	\N	2026-11-12 22:13:56.295155+09
d1b300c3-6cb0-434d-bff1-6b5059daaca5	3a1a615d-da53-4098-b81c-168537d9c5e7	manual_grant	500	0	620	0	admin_adjustment	073fc896-daeb-4582-9aeb-94543ae3bca8	\N	\N	\N	0	admin_adjustment:073fc896-daeb-4582-9aeb-94543ae3bca8	d0000000-0000-4000-8000-000000000001	시연용 포인트 지급	2026-11-12 22:13:56.540591+09
62dba9a9-bdb5-45c5-af02-32731881f341	3a1a615d-da53-4098-b81c-168537d9c5e7	spend	-250	0	370	0	shop_order	893730f4-2f81-4597-b5f0-273eb2b72fd8	\N	\N	\N	0	shop_order:893730f4-2f81-4597-b5f0-273eb2b72fd8:spend	\N	\N	2026-11-12 22:13:56.635345+09
3773c07e-b0b5-47dd-a01d-b83b7fa89386	29240605-e884-4515-bf20-783bb736f55a	auto_award	300	0	300	0	challenge	5ad0c018-a8d0-4b51-a024-908fd427b21b	\N	\N	2026-11-01	300	challenge:award:5ad0c018-a8d0-4b51-a024-908fd427b21b	\N	\N	2026-11-13 01:32:19.063903+09
1a86adb6-bd57-406d-a812-87f48d6cd483	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	20	0	mission	b8dfabd4-fcd8-495f-8138-467300129b2f	\N	\N	2026-11-01	20	mission:award:b8dfabd4-fcd8-495f-8138-467300129b2f	\N	\N	2026-11-13 01:32:19.302065+09
d417ec9c-0ad2-4281-81c0-2c705766c562	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	40	0	mission	004d6b39-2372-4ac3-8bcf-8f2da9a99eed	\N	\N	2026-11-01	20	mission:award:004d6b39-2372-4ac3-8bcf-8f2da9a99eed	\N	\N	2026-11-13 01:32:19.404851+09
f7358f21-6d07-45b5-be6d-7987b1273bfe	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	60	0	mission	2f1cfbee-4245-4815-ace9-239a4bd02cdb	\N	\N	2026-11-01	20	mission:award:2f1cfbee-4245-4815-ace9-239a4bd02cdb	\N	\N	2026-11-13 01:32:19.524537+09
a14d95f6-6ad9-4867-bc19-8877a3515fbc	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	80	0	mission	f5fb5a30-423e-4cd8-af24-d569aaea8544	\N	\N	2026-11-01	20	mission:award:f5fb5a30-423e-4cd8-af24-d569aaea8544	\N	\N	2026-11-13 01:32:19.655661+09
0000e798-f009-417f-a759-8209d2e6b9e7	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	100	0	mission	94657b05-ad70-4aee-abf7-ae2883bdd331	\N	\N	2026-11-01	20	mission:award:94657b05-ad70-4aee-abf7-ae2883bdd331	\N	\N	2026-11-13 01:32:19.761194+09
8409751a-0b14-4c75-b59f-6e25ecde0008	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	120	0	mission	f54a376a-6784-482c-9cdb-203df6894413	\N	\N	2026-11-01	20	mission:award:f54a376a-6784-482c-9cdb-203df6894413	\N	\N	2026-11-13 01:32:19.90753+09
3fde5437-6ded-4fab-b004-dce41851de8c	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	20	0	140	0	mission	5ddf1331-2d68-482b-80cf-f575076bc590	\N	\N	2026-11-01	20	mission:award:5ddf1331-2d68-482b-80cf-f575076bc590	\N	\N	2026-11-13 01:32:20.050038+09
1ad54d95-36e2-464d-a124-074a48953b64	644c7f97-852d-4339-97af-0e0deb46ac54	auto_award	70	0	210	0	streak	4d968b2c-5865-460c-8f44-1e29298667ed	\N	\N	2026-11-01	70	streak:award:644c7f97-852d-4339-97af-0e0deb46ac54:7	\N	\N	2026-11-13 01:32:20.050038+09
0d07befb-2a9d-42b4-90fa-33ab014940f8	b60ef6c5-f266-49ad-b850-21bd49a3916d	auto_award	20	0	20	0	mission	dab32a54-395a-41b3-a909-1a0e9573bfdb	\N	\N	2026-11-01	20	mission:award:dab32a54-395a-41b3-a909-1a0e9573bfdb	\N	\N	2026-11-13 01:32:20.550489+09
d4053835-d042-4195-a0ee-d772a6fc70b4	b60ef6c5-f266-49ad-b850-21bd49a3916d	manual_recovery	-14	0	6	0	admin_adjustment	596d0ee3-69f3-4486-9257-326961da5a88	\N	\N	\N	0	admin_adjustment:596d0ee3-69f3-4486-9257-326961da5a88	d0000000-0000-4000-8000-000000000001	시연: 잔액 일부 회수	2026-11-13 01:32:20.606218+09
1e9fceca-d57f-431b-ba21-dc4ec56afe91	b60ef6c5-f266-49ad-b850-21bd49a3916d	recovery	-6	0	0	0	mission	dab32a54-395a-41b3-a909-1a0e9573bfdb	0d07befb-2a9d-42b4-90fa-33ab014940f8	\N	2026-11-01	-6	mission:recovery:dab32a54-395a-41b3-a909-1a0e9573bfdb:d7fa93a2-fe51-4230-b50d-3748223bba90	\N	\N	2026-11-13 01:32:20.615144+09
8ee6c55a-b826-44e7-a7b8-24fda42e51ad	b60ef6c5-f266-49ad-b850-21bd49a3916d	recovery_claim	0	14	0	14	mission	dab32a54-395a-41b3-a909-1a0e9573bfdb	0d07befb-2a9d-42b4-90fa-33ab014940f8	6034c336-123b-408b-b64c-41bbc2495a81	\N	0	mission:recovery:dab32a54-395a-41b3-a909-1a0e9573bfdb:d7fa93a2-fe51-4230-b50d-3748223bba90:claim	\N	\N	2026-11-13 01:32:20.615144+09
35e98b9a-a859-4196-af48-e457d08760e6	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	auto_award	20	0	20	0	mission	cd187669-fdbb-4498-bf15-d1400cd645df	\N	\N	2026-11-01	20	mission:award:cd187669-fdbb-4498-bf15-d1400cd645df	\N	\N	2026-11-13 01:32:20.973576+09
be579f71-d064-4cd3-b5ce-4a47fdf5f6a6	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	auto_award	20	0	40	0	mission	65960e23-35c7-4eb8-9777-85c12cc04bea	\N	\N	2026-11-01	20	mission:award:65960e23-35c7-4eb8-9777-85c12cc04bea	\N	\N	2026-11-13 01:32:21.156807+09
b0687d0c-9a96-4554-8293-7189cf442935	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	auto_award	20	0	60	0	mission	439ad5a3-1d36-4fc8-a1fd-5fa9492743be	\N	\N	2026-11-01	20	mission:award:439ad5a3-1d36-4fc8-a1fd-5fa9492743be	\N	\N	2026-11-13 01:32:21.259333+09
71b4e5d7-c5a3-48b3-8004-71ac1598d8b3	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	auto_award	20	0	80	0	mission	31567496-c7cb-41e4-b0e0-f9e1b5684543	\N	\N	2026-11-01	20	mission:award:31567496-c7cb-41e4-b0e0-f9e1b5684543	\N	\N	2026-11-13 01:32:21.360127+09
42607b4c-53e1-4aac-b81f-ed38fa1eb089	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	auto_award	20	0	100	0	mission	da3e831b-31d4-468e-8081-1f7de3622a71	\N	\N	2026-11-01	20	mission:award:da3e831b-31d4-468e-8081-1f7de3622a71	\N	\N	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: point_wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_wallets (user_id, available_points, outstanding_recovery_points, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000601	0	0	2026-11-09 20:23:23.649051+09
3a1a615d-da53-4098-b81c-168537d9c5e7	370	0	2026-11-12 22:13:56.635345+09
389e1d24-ebcf-4081-898b-e9489d21d682	0	0	2026-11-13 01:32:16.60814+09
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	0	0	2026-11-13 01:32:16.791076+09
ad2ee538-8b45-4a7d-af16-84eba6f995e4	0	0	2026-11-13 01:32:17.199237+09
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	0	0	2026-11-13 01:32:17.497324+09
9c7af070-c543-4e0a-ba19-5dab3ceefad3	0	0	2026-11-13 01:32:17.713912+09
ef98fa2f-8486-4767-b11e-d00e5948cfd2	0	0	2026-11-13 01:32:17.846956+09
a45a1748-0674-4ebe-9b85-c0496143c495	0	0	2026-11-13 01:32:18.003838+09
29240605-e884-4515-bf20-783bb736f55a	300	0	2026-11-13 01:32:19.063903+09
644c7f97-852d-4339-97af-0e0deb46ac54	210	0	2026-11-13 01:32:20.050038+09
b60ef6c5-f266-49ad-b850-21bd49a3916d	0	14	2026-11-13 01:32:20.615144+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	100	0	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: policy_document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.policy_document_versions (id, document_type, version, body, effective_at, requires_reconsent, published_at) FROM stdin;
cd0e5d4e-fb2a-46b3-8ce4-70d81891b2e1	terms	dev-1	[DEV] terms placeholder text.	2026-01-01 00:00:00+09	f	2026-01-01 00:00:00+09
685fb01b-211a-4f52-97cc-48a307dbd021	privacy	dev-1	[DEV] privacy placeholder text.	2026-01-01 00:00:00+09	f	2026-01-01 00:00:00+09
915ee0e8-4f8a-46ab-a904-50b32d734bf1	marketing	dev-1	[DEV] marketing placeholder text.	2026-01-01 00:00:00+09	f	2026-01-01 00:00:00+09
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (user_id, nickname, notification_enabled, updated_at, representative_achievement_id, representative_pet_id) FROM stdin;
d0000000-0000-4000-8000-000000000601	개발유저	t	2026-11-09 20:23:23.649051+09	\N	d0000000-0000-4000-8000-000000000611
3a1a615d-da53-4098-b81c-168537d9c5e7	tester01	f	2026-11-12 22:13:52.994913+09	\N	8284b275-778f-45f4-81f0-5d12c87c5341
389e1d24-ebcf-4081-898b-e9489d21d682	제재시연	t	2026-11-13 01:32:16.60814+09	\N	\N
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	탈퇴요청시연	t	2026-11-13 01:32:16.791076+09	\N	\N
ad2ee538-8b45-4a7d-af16-84eba6f995e4	챌린지제작시연	t	2026-11-13 01:32:17.199237+09	\N	\N
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	정산시연A	t	2026-11-13 01:32:17.497324+09	\N	\N
29240605-e884-4515-bf20-783bb736f55a	정산시연B	t	2026-11-13 01:32:17.598587+09	\N	\N
9c7af070-c543-4e0a-ba19-5dab3ceefad3	정산시연C	t	2026-11-13 01:32:17.713912+09	\N	\N
ef98fa2f-8486-4767-b11e-d00e5948cfd2	정산시연D	t	2026-11-13 01:32:17.846956+09	\N	\N
a45a1748-0674-4ebe-9b85-c0496143c495	정산시연E	t	2026-11-13 01:32:18.003838+09	\N	\N
644c7f97-852d-4339-97af-0e0deb46ac54	연속기록시연	t	2026-11-13 01:32:19.239128+09	\N	\N
b60ef6c5-f266-49ad-b850-21bd49a3916d	포인트회수시연	t	2026-11-13 01:32:20.47098+09	\N	\N
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	펫진화시연	t	2026-11-13 01:32:20.837143+09	\N	c58b94f5-9ecc-4fb2-bd5a-d33b5797dede
\.


--
-- Data for Name: recommendation_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recommendation_messages (id, message, condition_type, condition_params, category_id, priority, starts_at, ends_at, is_active, created_by_admin_id, updated_by_admin_id, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000501	오늘도 건강한 하루예요!	always	{}	\N	10	\N	\N	t	d0000000-0000-4000-8000-000000000001	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000502	오늘 할 미션을 하나 골라볼까요?	no_mission_today	{}	\N	50	\N	\N	t	d0000000-0000-4000-8000-000000000001	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000503	연속 기록이 끊기기 전에 미션 하나만 해요!	streak_at_risk	{}	\N	90	\N	\N	t	d0000000-0000-4000-8000-000000000001	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (filename, checksum, applied_at) FROM stdin;
001_accounts.sql	8bfa6d424a1f3a4c4d58eb28a3af62b6b47bb39358cf2fa83a08aa20c62566b2	2026-11-09 20:23:11.746656+09
002_goals_missions.sql	d866aa1ceab66ffba72fab6a74c3b4029ee21706ea637c35959f06203673dbbd	2026-11-09 20:23:11.844137+09
003_verification_media.sql	31295055995805ffe9ff0a9479154945fbc941543f4b66019b488fe3da7cf04f	2026-11-09 20:23:11.924607+09
004_points.sql	f711513ddb4c52ce2a6b06b1c19a5a728e9d1b4c38c3ea41aedc50c007181174	2026-11-09 20:23:11.988181+09
005_streaks.sql	248fdc91b942017b790e94a0bf3fa959750fde156aa5770bc170076350db74a8	2026-11-09 20:23:12.029336+09
006_achievements_badges.sql	613bb61229a15e6821dc871a8c2d3e372e6235cd9cf06c33535d0164be352173	2026-11-09 20:23:12.15433+09
007_experience_pets.sql	8767332e7662732d429d06d377238934be16d3b554a5ef10086c01306125e942	2026-11-09 20:23:12.354999+09
008_challenges.sql	ee1df1109c1527bf6d2f3bc61bb7ba8f853bc0068e27da0b0ea86fd6e5e6b982	2026-11-09 20:23:12.596133+09
009_idempotency_jobs.sql	0c28da908bc64b144d59b2374479d0ac58f5022f8c06cf253ccfb7017378b9da	2026-11-09 20:23:12.637107+09
010_shop.sql	53219326aa512d95fbc6559cb1e8eb05e8ac36a563c7e5537dc3b382d7528a76	2026-11-09 20:23:12.70546+09
011_support_reports.sql	d026627fdd4b99df95eb02d6146ea3d6c4841f373ce9810b419a4450e181c4ea	2026-11-09 20:23:12.772389+09
012_notices_notifications.sql	bd643ffc51d7fd4c03c61b6069276f8157e2ee24fde455a946d58d79741b8644	2026-11-09 20:23:12.818636+09
013_recommendations_ai_analysis.sql	5216a2af4697442e4551327b9f5456a7a952f2897cb137077e9db0f3ba79c311	2026-11-09 20:23:12.91245+09
014_table_comments.sql	4a760dbd4b90de24ea6fecb882a8be3a10e60dd0ad4e0a8ecde3904f140ec794	2026-11-13 10:45:49.14477+09
\.


--
-- Data for Name: shop_item_price_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shop_item_price_versions (id, item_id, version_no, price_points, effective_at, created_by_admin_id, created_at) FROM stdin;
d0000000-0000-4000-8000-000000000411	d0000000-0000-4000-8000-000000000401	1	250	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000412	d0000000-0000-4000-8000-000000000402	1	1000	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: shop_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shop_items (id, code, name, description, item_kind, display_order, is_active, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000401	pet_snack	펫 간식	펫이 좋아하는 간식	consumable	1	t	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
d0000000-0000-4000-8000-000000000402	pet_hat	펫 모자	펫에게 씌워 줄 모자	permanent	2	t	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
\.


--
-- Data for Name: shop_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shop_orders (id, user_id, item_id, price_version_id, quantity, unit_points, status, spend_transaction_id, refund_transaction_id, cancel_reason, idempotency_key, created_at, cancelled_at) FROM stdin;
893730f4-2f81-4597-b5f0-273eb2b72fd8	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000401	d0000000-0000-4000-8000-000000000411	1	250	completed	62dba9a9-bdb5-45c5-af02-32731881f341	\N	\N	3dd7077a-6925-4fd5-bbf1-705cbc78e789	2026-11-12 22:13:56.635345+09	\N
\.


--
-- Data for Name: streak_days; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.streak_days (user_id, streak_date, status, qualifying_mission_id, qualifying_record_id, qualifying_result_id, created_at, updated_at) FROM stdin;
3a1a615d-da53-4098-b81c-168537d9c5e7	2026-11-12	success	13600eba-abb3-4336-81c6-600f64f70d0d	65634f3c-84a5-440a-bf42-db6a717a2e2e	6e776fbc-1872-4ae3-a789-e0bbd49bea8d	2026-11-12 22:13:54.780597+09	2026-11-12 22:13:54.780597+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-07	success	b8dfabd4-fcd8-495f-8138-467300129b2f	3557662f-2453-43be-9306-594e041ea972	dad7414d-7a82-47d1-84f4-5638b5baf472	2026-11-13 01:32:19.404851+09	2026-11-13 01:32:19.404851+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-08	success	004d6b39-2372-4ac3-8bcf-8f2da9a99eed	530195ae-e234-4bf8-b04e-3d45c7762370	72c75e30-931e-4ad7-879f-3fbd4f0f4231	2026-11-13 01:32:19.524537+09	2026-11-13 01:32:19.524537+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-09	success	2f1cfbee-4245-4815-ace9-239a4bd02cdb	a001c574-e3b4-49a7-82fd-e7f1e2c7d7da	fa36dcd0-0b68-4dea-9d55-b1e30cc0d2fa	2026-11-13 01:32:19.655661+09	2026-11-13 01:32:19.655661+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-10	success	f5fb5a30-423e-4cd8-af24-d569aaea8544	b1298b1e-8105-4cfa-a6c1-2c880e8dbb64	07f95efb-ca7f-4af0-8b11-b14c62f1d54b	2026-11-13 01:32:19.761194+09	2026-11-13 01:32:19.761194+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-11	success	94657b05-ad70-4aee-abf7-ae2883bdd331	bea3a7a2-187a-4d6d-8cba-152256e82d68	4fe076e9-6798-4569-a441-48b3dcec43c5	2026-11-13 01:32:19.90753+09	2026-11-13 01:32:19.90753+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-12	success	f54a376a-6784-482c-9cdb-203df6894413	d4a8c1f7-3cf4-41e5-bf7b-b973d88f4e95	fac762b7-7eef-432b-9060-f07a5b518c9f	2026-11-13 01:32:20.050038+09	2026-11-13 01:32:20.050038+09
644c7f97-852d-4339-97af-0e0deb46ac54	2026-11-13	success	5ddf1331-2d68-482b-80cf-f575076bc590	49cbb408-4390-468e-bcad-a9ac37a1dfc5	619852da-20e4-4396-8af2-c987a56b1401	2026-11-13 01:32:19.302065+09	2026-11-13 01:32:20.050038+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	2026-11-13	success	cd187669-fdbb-4498-bf15-d1400cd645df	06a3b961-0a64-4521-8e2c-88a0624276e4	2b67faef-0047-4495-88b4-0e75b3eb22da	2026-11-13 01:32:20.973576+09	2026-11-13 01:32:20.973576+09
\.


--
-- Data for Name: streak_milestone_awards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.streak_milestone_awards (id, user_id, target_success_days, policy_version_id, awarded_points, paid_points, first_achieved_date, status, created_at, updated_at) FROM stdin;
4d968b2c-5865-460c-8f44-1e29298667ed	644c7f97-852d-4339-97af-0e0deb46ac54	7	27e8e8f7-c25e-4fd1-8f10-a110bf428f58	70	70	2026-11-13	active	2026-11-13 01:32:20.050038+09	2026-11-13 01:32:20.050038+09
\.


--
-- Data for Name: streak_milestone_policy_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.streak_milestone_policy_versions (id, target_success_days, version_no, points, effective_at, created_by_admin_id, created_at, user_xp, pet_xp) FROM stdin;
27e8e8f7-c25e-4fd1-8f10-a110bf428f58	7	1	70	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	0	0
b8a11107-7abb-4fb6-a3b3-9327d7c2548d	30	1	300	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	0	0
8a439d2a-35fe-41da-87c3-cfcc5326e8e1	100	1	1000	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09	0	0
\.


--
-- Data for Name: streak_states; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.streak_states (user_id, current_success_days, longest_success_days, last_success_date, has_pending_days, last_recalculated_at) FROM stdin;
d0000000-0000-4000-8000-000000000601	0	0	\N	f	2026-11-09 20:23:23.649051+09
3a1a615d-da53-4098-b81c-168537d9c5e7	1	1	2026-11-12	f	2026-11-12 22:13:55.891063+09
389e1d24-ebcf-4081-898b-e9489d21d682	0	0	\N	f	2026-11-13 01:32:16.60814+09
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	0	0	\N	f	2026-11-13 01:32:16.791076+09
ad2ee538-8b45-4a7d-af16-84eba6f995e4	0	0	\N	f	2026-11-13 01:32:17.199237+09
ef98fa2f-8486-4767-b11e-d00e5948cfd2	0	0	\N	f	2026-11-13 01:32:17.846956+09
9c7af070-c543-4e0a-ba19-5dab3ceefad3	0	0	\N	f	2026-11-13 01:32:18.472229+09
a45a1748-0674-4ebe-9b85-c0496143c495	0	0	\N	f	2026-11-13 01:32:18.551755+09
29240605-e884-4515-bf20-783bb736f55a	0	0	\N	f	2026-11-13 01:32:18.756251+09
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	0	0	\N	f	2026-11-13 01:32:18.896608+09
644c7f97-852d-4339-97af-0e0deb46ac54	7	7	2026-11-13	f	2026-11-13 01:32:20.050038+09
b60ef6c5-f266-49ad-b850-21bd49a3916d	0	0	\N	f	2026-11-13 01:32:20.615144+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	1	1	2026-11-13	f	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: support_ticket_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_ticket_events (id, ticket_id, admin_id, event_type, visibility, body, created_at) FROM stdin;
e836a473-fccc-4887-a4e4-b59eaaa33a5a	0a688778-b7bb-47d9-9eab-e9b98d565585	\N	received	user	\N	2026-11-12 22:16:01.176068+09
b6af805b-e0be-4206-8b09-9727d9479e5c	0a688778-b7bb-47d9-9eab-e9b98d565585	d0000000-0000-4000-8000-000000000001	status_changed	internal	\N	2026-11-13 01:32:16.420797+09
e81706a7-3893-4454-ba6b-ee4401de1279	0a688778-b7bb-47d9-9eab-e9b98d565585	d0000000-0000-4000-8000-000000000001	status_changed	internal	\N	2026-11-13 01:32:16.431322+09
3de3ffe1-0814-459c-918e-c2c09615ea2a	0a688778-b7bb-47d9-9eab-e9b98d565585	d0000000-0000-4000-8000-000000000001	reply	user	문의 주셔서 감사합니다. 미션 시간은 미션 수정에서 바꿀 수 있어요.	2026-11-13 01:32:16.432504+09
\.


--
-- Data for Name: support_ticket_resolutions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_ticket_resolutions (ticket_id, ticket_type, outcome, user_reply, account_action_id, content_action, resolved_by_admin_id, resolved_at) FROM stdin;
0a688778-b7bb-47d9-9eab-e9b98d565585	inquiry	reply_only	문의 주셔서 감사합니다. 미션 시간은 미션 수정에서 바꿀 수 있어요.	\N	\N	d0000000-0000-4000-8000-000000000001	2026-11-13 01:32:16.412811+09
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, ticket_type, category, reporter_user_id, subject, body, target_user_id, target_mission_definition_id, target_challenge_id, target_kind, status, assigned_admin_id, received_at, completed_at) FROM stdin;
0a688778-b7bb-47d9-9eab-e9b98d565585	inquiry	mission	3a1a615d-da53-4098-b81c-168537d9c5e7	시연 문의	미션 시간을 바꿀 수 있나요?	\N	\N	\N	\N	completed	d0000000-0000-4000-8000-000000000001	2026-11-12 22:16:01.176068+09	2026-11-13 01:32:16.412811+09
\.


--
-- Data for Name: user_achievement_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_achievement_events (id, user_achievement_id, user_id, event_type, source_type, source_id, reason, idempotency_key, occurred_at) FROM stdin;
3d2ada4e-266e-4ec1-adef-b10dba38aab8	37fa1f67-5ea2-4e86-bdcd-d1174981e219	3a1a615d-da53-4098-b81c-168537d9c5e7	earned	goal	2b93ba45-8852-4c6b-b059-202aa4ba12f6	\N	achievement:earned:37fa1f67-5ea2-4e86-bdcd-d1174981e219	2026-11-12 22:13:56.295155+09
145b1d04-2814-404b-8fe4-9f71e94a65bd	9d980ef6-ad6a-4a14-a4ef-e600c65f83a9	644c7f97-852d-4339-97af-0e0deb46ac54	earned	streak	4d968b2c-5865-460c-8f44-1e29298667ed	\N	achievement:earned:9d980ef6-ad6a-4a14-a4ef-e600c65f83a9	2026-11-13 01:32:20.050038+09
\.


--
-- Data for Name: user_achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_achievements (id, user_id, achievement_id, achievement_version_id, badge_image_id, status, source_type, source_id, first_achieved_at, awarded_at, awarded_points, paid_points, updated_at) FROM stdin;
37fa1f67-5ea2-4e86-bdcd-d1174981e219	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000201	d0000000-0000-4000-8000-000000000221	d0000000-0000-4000-8000-000000000211	active	goal	2b93ba45-8852-4c6b-b059-202aa4ba12f6	2026-11-12 22:13:56.295+09	2026-11-12 22:13:56.295155+09	100	100	2026-11-12 22:13:56.295155+09
9d980ef6-ad6a-4a14-a4ef-e600c65f83a9	644c7f97-852d-4339-97af-0e0deb46ac54	d0000000-0000-4000-8000-000000000205	d0000000-0000-4000-8000-000000000225	d0000000-0000-4000-8000-000000000215	active	streak	4d968b2c-5865-460c-8f44-1e29298667ed	2026-11-13 01:32:20.05+09	2026-11-13 01:32:20.050038+09	0	0	2026-11-13 01:32:20.050038+09
\.


--
-- Data for Name: user_experience; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_experience (user_id, level_policy_version_id, total_xp, level_no, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000601	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-09 20:23:23.649051+09
3a1a615d-da53-4098-b81c-168537d9c5e7	75d5255b-9dee-4900-a616-1fa1353fb679	120	2	2026-11-12 22:13:56.295155+09
389e1d24-ebcf-4081-898b-e9489d21d682	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:16.60814+09
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:16.791076+09
ad2ee538-8b45-4a7d-af16-84eba6f995e4	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:17.199237+09
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:17.497324+09
9c7af070-c543-4e0a-ba19-5dab3ceefad3	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:17.713912+09
ef98fa2f-8486-4767-b11e-d00e5948cfd2	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:17.846956+09
a45a1748-0674-4ebe-9b85-c0496143c495	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:18.003838+09
29240605-e884-4515-bf20-783bb736f55a	75d5255b-9dee-4900-a616-1fa1353fb679	30	1	2026-11-13 01:32:19.063903+09
644c7f97-852d-4339-97af-0e0deb46ac54	75d5255b-9dee-4900-a616-1fa1353fb679	140	2	2026-11-13 01:32:20.050038+09
b60ef6c5-f266-49ad-b850-21bd49a3916d	75d5255b-9dee-4900-a616-1fa1353fb679	0	1	2026-11-13 01:32:20.615144+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	75d5255b-9dee-4900-a616-1fa1353fb679	100	2	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: user_identities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_identities (id, user_id, provider, provider_subject, email, linked_at) FROM stdin;
ce4cded4-77e6-453c-8cdd-74d0f6c5d81b	3a1a615d-da53-4098-b81c-168537d9c5e7	google	demo-google-subject	demo@example.test	2026-11-13 01:32:16.862451+09
\.


--
-- Data for Name: user_inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_inventory (user_id, item_id, quantity, updated_at) FROM stdin;
3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000401	1	2026-11-12 22:13:56.635345+09
\.


--
-- Data for Name: user_inventory_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_inventory_events (id, user_id, item_id, kind, quantity_delta, order_id, idempotency_key, occurred_at) FROM stdin;
d4bc3487-25e0-4468-ab67-00dce52ee29a	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000401	purchase	1	893730f4-2f81-4597-b5f0-273eb2b72fd8	shop_order:893730f4-2f81-4597-b5f0-273eb2b72fd8:purchase	2026-11-12 22:13:56.635345+09
\.


--
-- Data for Name: user_level_policy_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_level_policy_versions (id, version_no, effective_at, created_by_admin_id, created_at) FROM stdin;
75d5255b-9dee-4900-a616-1fa1353fb679	1	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
\.


--
-- Data for Name: user_level_thresholds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_level_thresholds (policy_version_id, level_no, min_total_xp) FROM stdin;
75d5255b-9dee-4900-a616-1fa1353fb679	1	0
75d5255b-9dee-4900-a616-1fa1353fb679	2	100
75d5255b-9dee-4900-a616-1fa1353fb679	3	300
75d5255b-9dee-4900-a616-1fa1353fb679	4	600
75d5255b-9dee-4900-a616-1fa1353fb679	5	1000
75d5255b-9dee-4900-a616-1fa1353fb679	6	1500
75d5255b-9dee-4900-a616-1fa1353fb679	7	2100
75d5255b-9dee-4900-a616-1fa1353fb679	8	2800
75d5255b-9dee-4900-a616-1fa1353fb679	9	3600
75d5255b-9dee-4900-a616-1fa1353fb679	10	4500
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_notifications (id, user_id, kind, notice_id, event_key, title, body, link_screen, created_at, read_at, push_status, push_sent_at, push_attempts, push_last_error) FROM stdin;
f40dfc70-8b53-4129-9db8-d010cb6bb5fb	3a1a615d-da53-4098-b81c-168537d9c5e7	system	\N	verification_result:6e776fbc-1872-4ae3-a789-e0bbd49bea8d	인증이 승인됐어요	「러닝 2km」 미션 인증이 승인됐어요.	\N	2026-11-12 22:13:54.780597+09	\N	none	\N	0	\N
c08940ea-45b6-4570-84f2-92c10094861f	3a1a615d-da53-4098-b81c-168537d9c5e7	system	\N	verification_result:fd531528-5a54-4625-8afd-c0311107a770	인증이 반려됐어요	「러닝 3km」 미션 인증이 반려됐어요. 사유를 확인해 주세요.	\N	2026-11-12 22:13:55.891063+09	\N	none	\N	0	\N
fcb15321-5a52-4684-80d5-534be51d21d7	3a1a615d-da53-4098-b81c-168537d9c5e7	notice	9ccf005a-fc4d-47ba-b4f8-f3c7319600e6	\N	시연 공지: D-World에 오신 걸 환영해요	오늘의 미션을 확인하고 펫과 함께 성장해 보세요.	\N	2026-11-12 22:16:01.03664+09	\N	skipped	\N	0	\N
90a20163-e235-47e3-8f1b-672f3b45c62e	3a1a615d-da53-4098-b81c-168537d9c5e7	system	\N	ticket_reply:3de3ffe1-0814-459c-918e-c2c09615ea2a	문의 답변이 도착했어요	앱에서 답변을 확인해 주세요.	\N	2026-11-13 01:32:16.412811+09	\N	none	\N	0	\N
2bce4ff4-69ba-4f03-be47-40eb260aa533	389e1d24-ebcf-4081-898b-e9489d21d682	system	\N	account_action:efc66460-22d3-4cfe-953a-e55eb6aed311	운영 정책 위반 경고	운영 정책 위반으로 경고가 부여되었어요.	\N	2026-11-13 01:32:16.635221+09	\N	none	\N	0	\N
efb527d1-a2bf-4c90-b589-bc8bf839a771	389e1d24-ebcf-4081-898b-e9489d21d682	system	\N	account_action:6e700b49-8629-460d-9fe8-f37ea492b8f3	이용 제한 안내	운영 정책 위반으로 일정 기간 새 활동을 할 수 없어요.	\N	2026-11-13 01:32:16.660418+09	\N	none	\N	0	\N
08d7483b-4610-4169-91be-e7b06575e921	3a1a615d-da53-4098-b81c-168537d9c5e7	system	\N	plan_adjustment:c216ea53-441b-40f9-a2c9-7c24cd06d0db	계획 조정 제안이 도착했어요	지난주 달성률이 낮아 이번 주 목표를 가볍게 낮춰 봤어요.	plan-adjustments/c216ea53-441b-40f9-a2c9-7c24cd06d0db	2026-11-13 01:32:17.065433+09	\N	none	\N	0	\N
58a1ce6e-149a-4782-9264-df974b79fe61	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	system	\N	verification_result:7336e49e-ab9e-4f9d-a619-00de9e0b60a9	인증이 승인됐어요	「시연 정산 챌린지 1일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.303115+09	\N	pending	\N	0	\N
82c75685-e6c9-45e2-aa07-76a6df256421	29240605-e884-4515-bf20-783bb736f55a	system	\N	verification_result:f5a8c566-4a03-449e-b67f-e47ebb4ce11e	인증이 승인됐어요	「시연 정산 챌린지 1일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.39453+09	\N	pending	\N	0	\N
268385de-bed3-4aa7-baae-d13a661b888c	9c7af070-c543-4e0a-ba19-5dab3ceefad3	system	\N	verification_result:22be3168-5569-4fd6-a9e3-9d437b81d38d	인증이 승인됐어요	「시연 정산 챌린지 1일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.472229+09	\N	pending	\N	0	\N
143a8913-4105-4c8f-a3f1-c0150e438909	a45a1748-0674-4ebe-9b85-c0496143c495	system	\N	verification_result:840c730a-8cf9-4fa5-9a30-0f05e5562873	인증이 승인됐어요	「시연 정산 챌린지 1일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.551755+09	\N	pending	\N	0	\N
6a688b78-94be-449b-b05b-8c9472e50351	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	system	\N	verification_result:ab0594d5-0702-4e1e-b29a-5ca4332af462	인증이 승인됐어요	「시연 정산 챌린지 2일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.669586+09	\N	pending	\N	0	\N
1ff82585-7eca-49cf-91dc-9f61775df39d	29240605-e884-4515-bf20-783bb736f55a	system	\N	verification_result:cf0ccb3c-9379-4efe-be3e-93868e1daa8a	인증이 승인됐어요	「시연 정산 챌린지 2일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.756251+09	\N	pending	\N	0	\N
df5d2dce-2611-498d-b03a-57c912a37e14	b3f92a4a-3ea2-4b6f-897b-25b798be71c6	system	\N	verification_result:f00ec4f1-d60f-4a0b-b181-5308f044b295	인증이 승인됐어요	「시연 정산 챌린지 3일차」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:18.896608+09	\N	pending	\N	0	\N
bf967361-d24a-4d5b-b075-321764838ea8	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:dad7414d-7a82-47d1-84f4-5638b5baf472	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.302065+09	\N	pending	\N	0	\N
291ba7b2-b671-48c1-8568-94c2e738cfc0	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:72c75e30-931e-4ad7-879f-3fbd4f0f4231	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.404851+09	\N	pending	\N	0	\N
6de587a6-c724-4c1c-ab9d-003916fbbf68	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:fa36dcd0-0b68-4dea-9d55-b1e30cc0d2fa	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.524537+09	\N	pending	\N	0	\N
b9cd4675-3da3-4069-a5df-f26e6a2f3110	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:07f95efb-ca7f-4af0-8b11-b14c62f1d54b	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.655661+09	\N	pending	\N	0	\N
517c9a70-321d-42d6-9b5d-095e804bf8f4	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:4fe076e9-6798-4569-a441-48b3dcec43c5	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.761194+09	\N	pending	\N	0	\N
c2c8fde8-2069-4b4a-9a84-b2ed76ed53a8	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:fac762b7-7eef-432b-9060-f07a5b518c9f	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:19.90753+09	\N	pending	\N	0	\N
e4fc889e-1839-4de2-8269-74e971913fdc	644c7f97-852d-4339-97af-0e0deb46ac54	system	\N	verification_result:619852da-20e4-4396-8af2-c987a56b1401	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:20.050038+09	\N	pending	\N	0	\N
7a26dd1e-209f-4b44-bf34-447c5a2fe762	b60ef6c5-f266-49ad-b850-21bd49a3916d	system	\N	verification_result:531b28da-4323-4cc5-b1d7-32be5791d89a	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:20.550489+09	\N	pending	\N	0	\N
be1ab117-6ea8-4118-97ab-2df90c083a6f	b60ef6c5-f266-49ad-b850-21bd49a3916d	system	\N	verification_result:d7fa93a2-fe51-4230-b50d-3748223bba90	인증이 반려됐어요	「시연 미션」 미션 인증이 반려됐어요. 사유를 확인해 주세요.	\N	2026-11-13 01:32:20.615144+09	\N	pending	\N	0	\N
791ba088-de5e-4203-8b47-43d4e8a7eff9	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	system	\N	verification_result:2b67faef-0047-4495-88b4-0e75b3eb22da	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:20.973576+09	\N	pending	\N	0	\N
8705c7e5-3c7d-4dc5-840d-94d618b9c394	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	system	\N	verification_result:0a22fb7b-a943-4cb8-8dc1-2216bc2fb11f	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:21.156807+09	\N	pending	\N	0	\N
01578922-8397-466e-ba4a-1d5234b48c4b	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	system	\N	verification_result:df8563bf-1100-4f02-80d8-b4071d1277d6	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:21.259333+09	\N	pending	\N	0	\N
7066b7b6-91ee-4deb-9851-3e90cad339ea	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	system	\N	verification_result:0fbe8d5f-cd0b-44c2-a24d-d22a494df19e	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:21.360127+09	\N	pending	\N	0	\N
0dcbda40-f171-4e6b-8f2f-bfc28011343f	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	system	\N	verification_result:5ea4ce03-7123-4702-bf3c-ae6e2d5c160d	인증이 승인됐어요	「시연 미션」 미션 인증이 승인됐어요.	\N	2026-11-13 01:32:21.464338+09	\N	pending	\N	0	\N
\.


--
-- Data for Name: user_pets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_pets (id, user_id, species_id, species_version_id, level_policy_version_id, nickname, total_xp, level_no, stage_no, selected_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000611	d0000000-0000-4000-8000-000000000601	d0000000-0000-4000-8000-000000000101	d0000000-0000-4000-8000-000000000111	f4de1036-6c05-45ba-987b-cb7dc6bdf437	꾸준이	0	1	1	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
8284b275-778f-45f4-81f0-5d12c87c5341	3a1a615d-da53-4098-b81c-168537d9c5e7	d0000000-0000-4000-8000-000000000101	d0000000-0000-4000-8000-000000000111	f4de1036-6c05-45ba-987b-cb7dc6bdf437	모모	10	1	1	2026-11-12 22:13:52.994913+09	2026-11-12 22:13:54.780597+09
c58b94f5-9ecc-4fb2-bd5a-d33b5797dede	c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	d0000000-0000-4000-8000-000000000101	d0000000-0000-4000-8000-000000000111	f4de1036-6c05-45ba-987b-cb7dc6bdf437	시연냥	50	1	2	2026-11-13 01:32:20.837143+09	2026-11-13 01:32:21.464338+09
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, status, created_at, updated_at) FROM stdin;
d0000000-0000-4000-8000-000000000601	active	2026-11-09 20:23:23.649051+09	2026-11-09 20:23:23.649051+09
3a1a615d-da53-4098-b81c-168537d9c5e7	active	2026-11-12 16:25:02.306978+09	2026-11-12 16:25:02.306978+09
389e1d24-ebcf-4081-898b-e9489d21d682	active	2026-11-13 01:32:16.60814+09	2026-11-13 01:32:16.60814+09
91d3cbbe-bb7f-48fe-9d5d-9df62cfb5b25	active	2026-11-13 01:32:16.791076+09	2026-11-13 01:32:16.791076+09
ad2ee538-8b45-4a7d-af16-84eba6f995e4	active	2026-11-13 01:32:17.199237+09	2026-11-13 01:32:17.199237+09
b3f92a4a-3ea2-4b6f-897b-25b798be71c6	active	2026-11-13 01:32:17.497324+09	2026-11-13 01:32:17.497324+09
29240605-e884-4515-bf20-783bb736f55a	active	2026-11-13 01:32:17.598587+09	2026-11-13 01:32:17.598587+09
9c7af070-c543-4e0a-ba19-5dab3ceefad3	active	2026-11-13 01:32:17.713912+09	2026-11-13 01:32:17.713912+09
ef98fa2f-8486-4767-b11e-d00e5948cfd2	active	2026-11-13 01:32:17.846956+09	2026-11-13 01:32:17.846956+09
a45a1748-0674-4ebe-9b85-c0496143c495	active	2026-11-13 01:32:18.003838+09	2026-11-13 01:32:18.003838+09
644c7f97-852d-4339-97af-0e0deb46ac54	active	2026-11-13 01:32:19.239128+09	2026-11-13 01:32:19.239128+09
b60ef6c5-f266-49ad-b850-21bd49a3916d	active	2026-11-13 01:32:20.47098+09	2026-11-13 01:32:20.47098+09
c5cd3f2c-fd4c-45ed-9b5f-921ac07980c3	active	2026-11-13 01:32:20.806656+09	2026-11-13 01:32:20.806656+09
\.


--
-- Data for Name: verification_appeals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_appeals (id, record_id, filed_by_user_id, original_result_id, reason, status, filed_at, reviewed_by_admin_id, resolution_result_id, resolved_at) FROM stdin;
8b3078d3-f573-4165-89bc-84e22d65b6c5	51aed45c-b842-44d4-bb28-c6caa7064f3d	3a1a615d-da53-4098-b81c-168537d9c5e7	fd531528-5a54-4625-8afd-c0311107a770	중간에 신호가 끊겨 거리가 덜 잡혔어요. 다시 확인 부탁드려요.	open	2026-11-12 22:13:56.102524+09	\N	\N	\N
\.


--
-- Data for Name: verification_criteria_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_criteria_versions (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id, created_at) FROM stdin;
a40234aa-f82d-460c-b80d-b42cd140b514	d0000000-0000-4000-8000-000000000011	camera	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
a39d60ce-a76b-496a-95ce-120e3254edc0	d0000000-0000-4000-8000-000000000011	sensor	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
a97f8a9d-9989-4c6d-a4a5-cc2af1ddd8e6	d0000000-0000-4000-8000-000000000012	camera	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
7ad05dc5-695a-429b-a36d-b4999b9806de	d0000000-0000-4000-8000-000000000012	sensor	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
6019e202-d2dd-4438-bb7c-e32bfd462fe9	d0000000-0000-4000-8000-000000000013	camera	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
96822f16-0740-44c8-8054-b84fca9a16e3	d0000000-0000-4000-8000-000000000013	sensor	1	{}	2026-01-01 00:00:00+09	d0000000-0000-4000-8000-000000000001	2026-11-09 20:23:23.066855+09
ef457f19-ceae-44d4-a0af-c940bd3cf8a9	d0000000-0000-4000-8000-000000000011	sensor	2	{"minDistanceMeters": 300, "minDurationSeconds": 300}	2026-11-13 10:46:06.818+09	d0000000-0000-4000-8000-000000000001	2026-11-13 10:46:06.818021+09
\.


--
-- Data for Name: verification_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_results (id, record_id, result_no, source, decision, criteria_version_id, engine_version, confidence, metrics, reason, reviewed_by_admin_id, is_current, decided_at, notified_at, ingest_key, raw_result) FROM stdin;
6e776fbc-1872-4ae3-a789-e0bbd49bea8d	65634f3c-84a5-440a-bf42-db6a717a2e2e	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9400	{"distanceMeters": 2300}	목표 거리 충족	\N	t	2026-11-12 22:13:54.780597+09	2026-11-12 22:13:54.780597+09	demo:65634f3c-84a5-440a-bf42-db6a717a2e2e	{"source": "demo"}
fd531528-5a54-4625-8afd-c0311107a770	51aed45c-b842-44d4-bb28-c6caa7064f3d	1	ai	rejected	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9400	{"distanceMeters": 1200}	목표 거리 미달	\N	t	2026-11-12 22:13:55.891063+09	2026-11-12 22:13:55.891063+09	demo:51aed45c-b842-44d4-bb28-c6caa7064f3d	{"source": "demo"}
fa36dcd0-0b68-4dea-9d55-b1e30cc0d2fa	a001c574-e3b4-49a7-82fd-e7f1e2c7d7da	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-09 01:32:19.524537+09	2026-11-09 01:32:19.524537+09	e478f758-6ba7-4963-8834-83a6d229aea4	{"demo": true}
07f95efb-ca7f-4af0-8b11-b14c62f1d54b	b1298b1e-8105-4cfa-a6c1-2c880e8dbb64	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-10 01:32:19.655661+09	2026-11-10 01:32:19.655661+09	f8093cb2-4951-480e-bad6-ee501bd3b140	{"demo": true}
4fe076e9-6798-4569-a441-48b3dcec43c5	bea3a7a2-187a-4d6d-8cba-152256e82d68	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-11 01:32:19.761194+09	2026-11-11 01:32:19.761194+09	bf97e840-43a6-49f0-995f-648cd4e43234	{"demo": true}
fac762b7-7eef-432b-9060-f07a5b518c9f	d4a8c1f7-3cf4-41e5-bf7b-b973d88f4e95	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-12 01:32:19.90753+09	2026-11-12 01:32:19.90753+09	73b79935-5111-4708-b176-78bba8f7e4be	{"demo": true}
619852da-20e4-4396-8af2-c987a56b1401	49cbb408-4390-468e-bcad-a9ac37a1dfc5	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:20.050038+09	2026-11-13 01:32:20.050038+09	617bc03b-e0ac-43ae-9c00-03e1348a5a8f	{"demo": true}
531b28da-4323-4cc5-b1d7-32be5791d89a	51fd2acb-7af2-4a5d-846d-d0bd7cc248b7	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	f	2026-11-13 01:32:20.550489+09	2026-11-13 01:32:20.550489+09	4e494afe-1825-4e6d-8799-ff14a3cf3abb	{"demo": true}
ab0594d5-0702-4e1e-b29a-5ca4332af462	ea1c96c2-64c5-455e-9d60-69ce790f6b93	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-07 01:32:18.669586+09	2026-11-07 01:32:18.669586+09	93e77ce5-34f1-4883-8eed-4819fe08a1c5	{"demo": true}
840c730a-8cf9-4fa5-9a30-0f05e5562873	367dfa7e-50bf-496a-8221-c10ee75ea68d	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-06 01:32:18.551755+09	2026-11-06 01:32:18.551755+09	a7487e00-60f2-4b42-b447-dfa298ba8c74	{"demo": true}
f5a8c566-4a03-449e-b67f-e47ebb4ce11e	84718825-134a-4e13-8186-01d0cd244e6a	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-06 01:32:18.39453+09	2026-11-06 01:32:18.39453+09	b76ce078-48f5-4518-a67c-aa4b270c86eb	{"demo": true}
7336e49e-ab9e-4f9d-a619-00de9e0b60a9	59f80d77-30d0-4122-8ee6-b4f2e93314d5	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-06 01:32:18.303115+09	2026-11-06 01:32:18.303115+09	c3a14a95-3b7a-45ca-ade2-442c22747feb	{"demo": true}
f00ec4f1-d60f-4a0b-b181-5308f044b295	d02f7e86-74ae-41f9-b75a-6b45921e1cbe	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-08 01:32:18.896608+09	2026-11-08 01:32:18.896608+09	1c6b8b63-38cc-430b-84fb-73c0d9e0ef2f	{"demo": true}
cf0ccb3c-9379-4efe-be3e-93868e1daa8a	bad0252a-786b-438e-b8f1-3618f515fb14	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-07 01:32:18.756251+09	2026-11-07 01:32:18.756251+09	56ecd11b-49cc-4aeb-bd67-dace12970fe5	{"demo": true}
22be3168-5569-4fd6-a9e3-9d437b81d38d	0576dd6f-f70a-4408-92e7-851958f4dec6	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-06 01:32:18.472229+09	2026-11-06 01:32:18.472229+09	bd5c5774-c99e-4854-825b-770cc5f46f18	{"demo": true}
dad7414d-7a82-47d1-84f4-5638b5baf472	3557662f-2453-43be-9306-594e041ea972	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-07 01:32:19.302065+09	2026-11-07 01:32:19.302065+09	2b56b019-10f1-48ff-b60f-5a7bec4fdc61	{"demo": true}
72c75e30-931e-4ad7-879f-3fbd4f0f4231	530195ae-e234-4bf8-b04e-3d45c7762370	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-08 01:32:19.404851+09	2026-11-08 01:32:19.404851+09	10a25df1-b647-4e1e-b9e7-60281e1f9c5f	{"demo": true}
d7fa93a2-fe51-4230-b50d-3748223bba90	51fd2acb-7af2-4a5d-846d-d0bd7cc248b7	2	admin	rejected	a39d60ce-a76b-496a-95ce-120e3254edc0	\N	\N	\N	시연: 재판정으로 승인 취소	d0000000-0000-4000-8000-000000000001	t	2026-11-13 01:32:20.615144+09	2026-11-13 01:32:20.615144+09	\N	\N
2b67faef-0047-4495-88b4-0e75b3eb22da	06a3b961-0a64-4521-8e2c-88a0624276e4	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:20.973576+09	2026-11-13 01:32:20.973576+09	fccab1e0-e593-4d38-abeb-8d31af7a5512	{"demo": true}
0a22fb7b-a943-4cb8-8dc1-2216bc2fb11f	072cde38-7832-44aa-a390-1d6d636ae584	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:21.156807+09	2026-11-13 01:32:21.156807+09	9e66f178-e141-4c1b-972a-098078629f74	{"demo": true}
df8563bf-1100-4f02-80d8-b4071d1277d6	7a236fa2-c41f-4074-8069-5a6de9f23fe4	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:21.259333+09	2026-11-13 01:32:21.259333+09	dfe8a5ca-efbe-45eb-9eed-d9a7f75efda6	{"demo": true}
0fbe8d5f-cd0b-44c2-a24d-d22a494df19e	dcbddd64-78c0-4cb4-af8a-d7211e5e9888	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:21.360127+09	2026-11-13 01:32:21.360127+09	0e46e7ba-8ef7-4092-82a0-de649bbd44fc	{"demo": true}
5ea4ce03-7123-4702-bf3c-ae6e2d5c160d	3632a9f8-ace5-4790-b466-5663b7e2afcf	1	ai	approved	a39d60ce-a76b-496a-95ce-120e3254edc0	demo-model@1	0.9000	{"score": 0.5}	시연 판정	\N	t	2026-11-13 01:32:21.464338+09	2026-11-13 01:32:21.464338+09	c60bcc39-1f84-472d-a8c4-f42d0937fc80	{"demo": true}
\.


--
-- Data for Name: weather_grid_cells; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.weather_grid_cells (nx, ny, first_requested_at, last_requested_at) FROM stdin;
60	127	2026-11-12 22:16:01.291328+09	2026-11-12 23:07:26.524131+09
\.


--
-- Data for Name: weather_observations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.weather_observations (nx, ny, observed_at, weather, temperature_c, fetched_at) FROM stdin;
60	127	2026-11-12 22:00:00+09	clear	12	2026-11-12 22:16:01.291328+09
\.


--
-- Name: account_actions account_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_actions
    ADD CONSTRAINT account_actions_pkey PRIMARY KEY (id);


--
-- Name: account_withdrawal_requests account_withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_withdrawal_requests
    ADD CONSTRAINT account_withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: achievement_backfill_runs achievement_backfill_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_backfill_runs
    ADD CONSTRAINT achievement_backfill_runs_pkey PRIMARY KEY (id);


--
-- Name: achievement_backfill_runs achievement_backfill_runs_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_backfill_runs
    ADD CONSTRAINT achievement_backfill_runs_version_id_key UNIQUE (version_id);


--
-- Name: achievement_badge_images achievement_badge_images_achievement_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_achievement_id_version_no_key UNIQUE (achievement_id, version_no);


--
-- Name: achievement_badge_images achievement_badge_images_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_id_achievement_id_key UNIQUE (id, achievement_id);


--
-- Name: achievement_badge_images achievement_badge_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_pkey PRIMARY KEY (id);


--
-- Name: achievement_badge_images achievement_badge_images_r2_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_r2_object_key_key UNIQUE (r2_object_key);


--
-- Name: achievement_definitions achievement_definitions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_code_key UNIQUE (code);


--
-- Name: achievement_definitions achievement_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_pkey PRIMARY KEY (id);


--
-- Name: achievement_versions achievement_versions_achievement_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_achievement_id_version_no_key UNIQUE (achievement_id, version_no);


--
-- Name: achievement_versions achievement_versions_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_id_achievement_id_key UNIQUE (id, achievement_id);


--
-- Name: achievement_versions achievement_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_pkey PRIMARY KEY (id);


--
-- Name: admin_accounts admin_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_accounts
    ADD CONSTRAINT admin_accounts_pkey PRIMARY KEY (id);


--
-- Name: admin_asset_uploads admin_asset_uploads_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_asset_uploads
    ADD CONSTRAINT admin_asset_uploads_object_key_key UNIQUE (object_key);


--
-- Name: admin_asset_uploads admin_asset_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_asset_uploads
    ADD CONSTRAINT admin_asset_uploads_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_idempotency_keys admin_idempotency_keys_admin_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_idempotency_keys
    ADD CONSTRAINT admin_idempotency_keys_admin_id_idempotency_key_key UNIQUE (admin_id, idempotency_key);


--
-- Name: admin_idempotency_keys admin_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_idempotency_keys
    ADD CONSTRAINT admin_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: ai_analysis_runs ai_analysis_runs_id_run_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_id_run_type_key UNIQUE (id, run_type);


--
-- Name: ai_analysis_runs ai_analysis_runs_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_id_user_id_key UNIQUE (id, user_id);


--
-- Name: ai_analysis_runs ai_analysis_runs_ingest_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_ingest_key_key UNIQUE (ingest_key);


--
-- Name: ai_analysis_runs ai_analysis_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_pkey PRIMARY KEY (id);


--
-- Name: ai_mission_recommendations ai_mission_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_mission_recommendations_pkey PRIMARY KEY (id);


--
-- Name: ai_mission_recommendations ai_mission_recommendations_run_id_rank_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_mission_recommendations_run_id_rank_no_key UNIQUE (run_id, rank_no);


--
-- Name: ai_plan_proposals ai_plan_proposals_goal_id_generation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_plan_proposals
    ADD CONSTRAINT ai_plan_proposals_goal_id_generation_no_key UNIQUE (goal_id, generation_no);


--
-- Name: ai_plan_proposals ai_plan_proposals_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_plan_proposals
    ADD CONSTRAINT ai_plan_proposals_id_user_id_key UNIQUE (id, user_id);


--
-- Name: ai_plan_proposals ai_plan_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_plan_proposals
    ADD CONSTRAINT ai_plan_proposals_pkey PRIMARY KEY (id);


--
-- Name: ai_reports ai_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT ai_reports_pkey PRIMARY KEY (run_id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: challenge_daily_missions challenge_daily_missions_id_participation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_id_participation_id_key UNIQUE (id, participation_id);


--
-- Name: challenge_daily_missions challenge_daily_missions_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_mission_id_key UNIQUE (mission_id);


--
-- Name: challenge_daily_missions challenge_daily_missions_participation_id_challenge_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_participation_id_challenge_date_key UNIQUE (participation_id, challenge_date);


--
-- Name: challenge_daily_missions challenge_daily_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_pkey PRIMARY KEY (id);


--
-- Name: challenge_final_rankings challenge_final_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_final_rankings
    ADD CONSTRAINT challenge_final_rankings_pkey PRIMARY KEY (id);


--
-- Name: challenge_final_rankings challenge_final_rankings_run_id_participation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_final_rankings
    ADD CONSTRAINT challenge_final_rankings_run_id_participation_id_key UNIQUE (run_id, participation_id);


--
-- Name: challenge_final_rankings challenge_final_rankings_run_id_rank_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_final_rankings
    ADD CONSTRAINT challenge_final_rankings_run_id_rank_no_key UNIQUE (run_id, rank_no);


--
-- Name: challenge_moderation_actions challenge_moderation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_moderation_actions
    ADD CONSTRAINT challenge_moderation_actions_pkey PRIMARY KEY (id);


--
-- Name: challenge_participations challenge_participations_challenge_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_challenge_id_user_id_key UNIQUE (challenge_id, user_id);


--
-- Name: challenge_participations challenge_participations_id_challenge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_id_challenge_id_key UNIQUE (id, challenge_id);


--
-- Name: challenge_participations challenge_participations_id_challenge_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_id_challenge_id_user_id_key UNIQUE (id, challenge_id, user_id);


--
-- Name: challenge_participations challenge_participations_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_id_user_id_key UNIQUE (id, user_id);


--
-- Name: challenge_participations challenge_participations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_pkey PRIMARY KEY (id);


--
-- Name: challenge_publication_reviews challenge_publication_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_publication_reviews
    ADD CONSTRAINT challenge_publication_reviews_pkey PRIMARY KEY (id);


--
-- Name: challenge_reward_grants challenge_reward_grants_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_id_user_id_key UNIQUE (id, user_id);


--
-- Name: challenge_reward_grants challenge_reward_grants_participation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_participation_id_key UNIQUE (participation_id);


--
-- Name: challenge_reward_grants challenge_reward_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_pkey PRIMARY KEY (id);


--
-- Name: challenge_reward_packages challenge_reward_packages_badge_achievement_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_packages
    ADD CONSTRAINT challenge_reward_packages_badge_achievement_version_id_key UNIQUE (badge_achievement_version_id);


--
-- Name: challenge_reward_packages challenge_reward_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_packages
    ADD CONSTRAINT challenge_reward_packages_pkey PRIMARY KEY (challenge_id);


--
-- Name: challenge_reward_payment_attempts challenge_reward_payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_payment_attempts
    ADD CONSTRAINT challenge_reward_payment_attempts_pkey PRIMARY KEY (run_id, participation_id);


--
-- Name: challenge_rule_events challenge_rule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_rule_events
    ADD CONSTRAINT challenge_rule_events_pkey PRIMARY KEY (id);


--
-- Name: challenge_score_snapshots challenge_score_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_score_snapshots
    ADD CONSTRAINT challenge_score_snapshots_pkey PRIMARY KEY (challenge_id, participation_id);


--
-- Name: challenge_settlement_entries challenge_settlement_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_entries
    ADD CONSTRAINT challenge_settlement_entries_pkey PRIMARY KEY (run_id, participation_id);


--
-- Name: challenge_settlement_runs challenge_settlement_runs_challenge_id_run_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_runs
    ADD CONSTRAINT challenge_settlement_runs_challenge_id_run_no_key UNIQUE (challenge_id, run_no);


--
-- Name: challenge_settlement_runs challenge_settlement_runs_id_challenge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_runs
    ADD CONSTRAINT challenge_settlement_runs_id_challenge_id_key UNIQUE (id, challenge_id);


--
-- Name: challenge_settlement_runs challenge_settlement_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_runs
    ADD CONSTRAINT challenge_settlement_runs_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: difficulty_levels difficulty_levels_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.difficulty_levels
    ADD CONSTRAINT difficulty_levels_code_key UNIQUE (code);


--
-- Name: difficulty_levels difficulty_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.difficulty_levels
    ADD CONSTRAINT difficulty_levels_name_key UNIQUE (name);


--
-- Name: difficulty_levels difficulty_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.difficulty_levels
    ADD CONSTRAINT difficulty_levels_pkey PRIMARY KEY (id);


--
-- Name: experience_awards experience_awards_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_id_user_id_key UNIQUE (id, user_id);


--
-- Name: experience_awards experience_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_pkey PRIMARY KEY (id);


--
-- Name: experience_awards experience_awards_user_id_source_type_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_user_id_source_type_source_id_key UNIQUE (user_id, source_type, source_id);


--
-- Name: experience_transactions experience_transactions_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_id_user_id_key UNIQUE (id, user_id);


--
-- Name: experience_transactions experience_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: experience_transactions experience_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_pkey PRIMARY KEY (id);


--
-- Name: goal_categories goal_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_categories
    ADD CONSTRAINT goal_categories_code_key UNIQUE (code);


--
-- Name: goal_categories goal_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_categories
    ADD CONSTRAINT goal_categories_name_key UNIQUE (name);


--
-- Name: goal_categories goal_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_categories
    ADD CONSTRAINT goal_categories_pkey PRIMARY KEY (id);


--
-- Name: goal_steps goal_steps_goal_id_step_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_steps
    ADD CONSTRAINT goal_steps_goal_id_step_no_key UNIQUE (goal_id, step_no);


--
-- Name: goal_steps goal_steps_id_goal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_steps
    ADD CONSTRAINT goal_steps_id_goal_id_key UNIQUE (id, goal_id);


--
-- Name: goal_steps goal_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_steps
    ADD CONSTRAINT goal_steps_pkey PRIMARY KEY (id);


--
-- Name: goals goals_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_id_user_id_key UNIQUE (id, user_id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_object_key_key UNIQUE (object_key);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: mission_definitions mission_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_definitions
    ADD CONSTRAINT mission_definitions_pkey PRIMARY KEY (id);


--
-- Name: mission_point_awards mission_point_awards_mission_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_point_awards
    ADD CONSTRAINT mission_point_awards_mission_id_user_id_key UNIQUE (mission_id, user_id);


--
-- Name: mission_point_awards mission_point_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_point_awards
    ADD CONSTRAINT mission_point_awards_pkey PRIMARY KEY (mission_id);


--
-- Name: mission_publication_reviews mission_publication_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_publication_reviews
    ADD CONSTRAINT mission_publication_reviews_pkey PRIMARY KEY (id);


--
-- Name: mission_records mission_records_id_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_id_mission_id_key UNIQUE (id, mission_id);


--
-- Name: mission_records mission_records_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_id_user_id_key UNIQUE (id, user_id);


--
-- Name: mission_records mission_records_mission_id_attempt_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_mission_id_attempt_no_key UNIQUE (mission_id, attempt_no);


--
-- Name: mission_records mission_records_mission_id_submission_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_mission_id_submission_no_key UNIQUE (mission_id, submission_no);


--
-- Name: mission_records mission_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_pkey PRIMARY KEY (id);


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_category_id_difficulty_id_vers_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_category_id_difficulty_id_vers_key UNIQUE (category_id, difficulty_id, version_no);


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_id_category_id_difficulty_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_id_category_id_difficulty_id_key UNIQUE (id, category_id, difficulty_id);


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_pkey PRIMARY KEY (id);


--
-- Name: missions missions_id_user_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_id_user_id_uq UNIQUE (id, user_id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: notice_recipients notice_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_recipients
    ADD CONSTRAINT notice_recipients_pkey PRIMARY KEY (notice_id, user_id);


--
-- Name: notices notices_id_audience_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_id_audience_type_key UNIQUE (id, audience_type);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: pending_pet_experience pending_pet_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_pet_experience
    ADD CONSTRAINT pending_pet_experience_pkey PRIMARY KEY (experience_award_id);


--
-- Name: pet_evolution_events pet_evolution_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_evolution_events
    ADD CONSTRAINT pet_evolution_events_pkey PRIMARY KEY (id);


--
-- Name: pet_level_policy_versions pet_level_policy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_policy_versions
    ADD CONSTRAINT pet_level_policy_versions_pkey PRIMARY KEY (id);


--
-- Name: pet_level_policy_versions pet_level_policy_versions_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_policy_versions
    ADD CONSTRAINT pet_level_policy_versions_version_no_key UNIQUE (version_no);


--
-- Name: pet_level_thresholds pet_level_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_thresholds
    ADD CONSTRAINT pet_level_thresholds_pkey PRIMARY KEY (policy_version_id, level_no);


--
-- Name: pet_level_thresholds pet_level_thresholds_policy_version_id_min_total_xp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_thresholds
    ADD CONSTRAINT pet_level_thresholds_policy_version_id_min_total_xp_key UNIQUE (policy_version_id, min_total_xp);


--
-- Name: pet_species pet_species_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species
    ADD CONSTRAINT pet_species_code_key UNIQUE (code);


--
-- Name: pet_species pet_species_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species
    ADD CONSTRAINT pet_species_pkey PRIMARY KEY (id);


--
-- Name: pet_species_versions pet_species_versions_id_species_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_id_species_id_key UNIQUE (id, species_id);


--
-- Name: pet_species_versions pet_species_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_pkey PRIMARY KEY (id);


--
-- Name: pet_species_versions pet_species_versions_species_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_species_id_version_no_key UNIQUE (species_id, version_no);


--
-- Name: pet_stage_dialogues pet_stage_dialogues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_dialogues
    ADD CONSTRAINT pet_stage_dialogues_pkey PRIMARY KEY (species_version_id, stage_no, dialogue_no);


--
-- Name: pet_stage_images pet_stage_images_id_species_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_images
    ADD CONSTRAINT pet_stage_images_id_species_id_key UNIQUE (id, species_id);


--
-- Name: pet_stage_images pet_stage_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_images
    ADD CONSTRAINT pet_stage_images_pkey PRIMARY KEY (id);


--
-- Name: pet_stage_images pet_stage_images_r2_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_images
    ADD CONSTRAINT pet_stage_images_r2_object_key_key UNIQUE (r2_object_key);


--
-- Name: pet_stage_versions pet_stage_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_versions
    ADD CONSTRAINT pet_stage_versions_pkey PRIMARY KEY (species_version_id, stage_no);


--
-- Name: phone_credentials phone_credentials_phone_e164_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_credentials
    ADD CONSTRAINT phone_credentials_phone_e164_key UNIQUE (phone_e164);


--
-- Name: phone_credentials phone_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_credentials
    ADD CONSTRAINT phone_credentials_pkey PRIMARY KEY (user_id);


--
-- Name: phone_verification_challenges phone_verification_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verification_challenges
    ADD CONSTRAINT phone_verification_challenges_pkey PRIMARY KEY (id);


--
-- Name: plan_adjustment_proposals plan_adjustment_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_adjustment_proposals
    ADD CONSTRAINT plan_adjustment_proposals_pkey PRIMARY KEY (id);


--
-- Name: plan_adjustment_proposals plan_adjustment_proposals_run_id_goal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_adjustment_proposals
    ADD CONSTRAINT plan_adjustment_proposals_run_id_goal_id_key UNIQUE (run_id, goal_id);


--
-- Name: point_monthly_cap_policies point_monthly_cap_policies_effective_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_monthly_cap_policies
    ADD CONSTRAINT point_monthly_cap_policies_effective_month_key UNIQUE (effective_month);


--
-- Name: point_monthly_cap_policies point_monthly_cap_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_monthly_cap_policies
    ADD CONSTRAINT point_monthly_cap_policies_pkey PRIMARY KEY (id);


--
-- Name: point_monthly_usage point_monthly_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_monthly_usage
    ADD CONSTRAINT point_monthly_usage_pkey PRIMARY KEY (user_id, month_start_date);


--
-- Name: point_recovery_claims point_recovery_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_claims_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_id_user_id_key UNIQUE (id, user_id);


--
-- Name: point_transactions point_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: point_wallets point_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_wallets
    ADD CONSTRAINT point_wallets_pkey PRIMARY KEY (user_id);


--
-- Name: policy_document_versions policy_document_versions_document_type_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_document_versions
    ADD CONSTRAINT policy_document_versions_document_type_version_key UNIQUE (document_type, version);


--
-- Name: policy_document_versions policy_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_document_versions
    ADD CONSTRAINT policy_document_versions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: push_devices push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_pkey PRIMARY KEY (id);


--
-- Name: push_devices push_devices_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_token_key UNIQUE (token);


--
-- Name: recommendation_messages recommendation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_messages
    ADD CONSTRAINT recommendation_messages_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: shop_item_price_versions shop_item_price_versions_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_item_price_versions
    ADD CONSTRAINT shop_item_price_versions_id_item_id_key UNIQUE (id, item_id);


--
-- Name: shop_item_price_versions shop_item_price_versions_item_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_item_price_versions
    ADD CONSTRAINT shop_item_price_versions_item_id_version_no_key UNIQUE (item_id, version_no);


--
-- Name: shop_item_price_versions shop_item_price_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_item_price_versions
    ADD CONSTRAINT shop_item_price_versions_pkey PRIMARY KEY (id);


--
-- Name: shop_items shop_items_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_items
    ADD CONSTRAINT shop_items_code_key UNIQUE (code);


--
-- Name: shop_items shop_items_id_item_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_items
    ADD CONSTRAINT shop_items_id_item_kind_key UNIQUE (id, item_kind);


--
-- Name: shop_items shop_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_items
    ADD CONSTRAINT shop_items_pkey PRIMARY KEY (id);


--
-- Name: shop_orders shop_orders_id_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_id_user_id_item_id_key UNIQUE (id, user_id, item_id);


--
-- Name: shop_orders shop_orders_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_id_user_id_key UNIQUE (id, user_id);


--
-- Name: shop_orders shop_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);


--
-- Name: shop_orders shop_orders_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: streak_days streak_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_days
    ADD CONSTRAINT streak_days_pkey PRIMARY KEY (user_id, streak_date);


--
-- Name: streak_milestone_awards streak_milestone_awards_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_id_user_id_key UNIQUE (id, user_id);


--
-- Name: streak_milestone_awards streak_milestone_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_pkey PRIMARY KEY (id);


--
-- Name: streak_milestone_awards streak_milestone_awards_user_id_target_success_days_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_user_id_target_success_days_key UNIQUE (user_id, target_success_days);


--
-- Name: streak_milestone_policy_versions streak_milestone_policy_versi_target_success_days_version_n_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_policy_versions
    ADD CONSTRAINT streak_milestone_policy_versi_target_success_days_version_n_key UNIQUE (target_success_days, version_no);


--
-- Name: streak_milestone_policy_versions streak_milestone_policy_versions_id_target_success_days_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_policy_versions
    ADD CONSTRAINT streak_milestone_policy_versions_id_target_success_days_key UNIQUE (id, target_success_days);


--
-- Name: streak_milestone_policy_versions streak_milestone_policy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_policy_versions
    ADD CONSTRAINT streak_milestone_policy_versions_pkey PRIMARY KEY (id);


--
-- Name: streak_states streak_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_states
    ADD CONSTRAINT streak_states_pkey PRIMARY KEY (user_id);


--
-- Name: support_ticket_events support_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_resolutions support_ticket_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_resolutions
    ADD CONSTRAINT support_ticket_resolutions_pkey PRIMARY KEY (ticket_id);


--
-- Name: support_tickets support_tickets_id_ticket_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_id_ticket_type_key UNIQUE (id, ticket_type);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: user_achievement_events user_achievement_events_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_events
    ADD CONSTRAINT user_achievement_events_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: user_achievement_events user_achievement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_events
    ADD CONSTRAINT user_achievement_events_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_id_user_id_key UNIQUE (id, user_id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_user_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);


--
-- Name: user_experience user_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_experience
    ADD CONSTRAINT user_experience_pkey PRIMARY KEY (user_id);


--
-- Name: user_idempotency_keys user_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_idempotency_keys
    ADD CONSTRAINT user_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: user_idempotency_keys user_idempotency_keys_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_idempotency_keys
    ADD CONSTRAINT user_idempotency_keys_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_provider_provider_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_provider_provider_subject_key UNIQUE (provider, provider_subject);


--
-- Name: user_identities user_identities_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: user_inventory_events user_inventory_events_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory_events
    ADD CONSTRAINT user_inventory_events_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: user_inventory_events user_inventory_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory_events
    ADD CONSTRAINT user_inventory_events_pkey PRIMARY KEY (id);


--
-- Name: user_inventory user_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (user_id, item_id);


--
-- Name: user_level_policy_versions user_level_policy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_policy_versions
    ADD CONSTRAINT user_level_policy_versions_pkey PRIMARY KEY (id);


--
-- Name: user_level_policy_versions user_level_policy_versions_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_policy_versions
    ADD CONSTRAINT user_level_policy_versions_version_no_key UNIQUE (version_no);


--
-- Name: user_level_thresholds user_level_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_thresholds
    ADD CONSTRAINT user_level_thresholds_pkey PRIMARY KEY (policy_version_id, level_no);


--
-- Name: user_level_thresholds user_level_thresholds_policy_version_id_min_total_xp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_thresholds
    ADD CONSTRAINT user_level_thresholds_policy_version_id_min_total_xp_key UNIQUE (policy_version_id, min_total_xp);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_user_id_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_event_key_key UNIQUE (user_id, event_key);


--
-- Name: user_notifications user_notifications_user_id_notice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_notice_id_key UNIQUE (user_id, notice_id);


--
-- Name: user_pets user_pets_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_id_user_id_key UNIQUE (id, user_id);


--
-- Name: user_pets user_pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_pkey PRIMARY KEY (id);


--
-- Name: user_pets user_pets_user_id_species_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_user_id_species_id_key UNIQUE (user_id, species_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_appeals verification_appeals_original_result_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_original_result_id_key UNIQUE (original_result_id);


--
-- Name: verification_appeals verification_appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_pkey PRIMARY KEY (id);


--
-- Name: verification_criteria_versions verification_criteria_version_category_id_verification_meth_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_criteria_versions
    ADD CONSTRAINT verification_criteria_version_category_id_verification_meth_key UNIQUE (category_id, verification_method, version_no);


--
-- Name: verification_criteria_versions verification_criteria_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_criteria_versions
    ADD CONSTRAINT verification_criteria_versions_pkey PRIMARY KEY (id);


--
-- Name: verification_results verification_results_id_record_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_id_record_id_key UNIQUE (id, record_id);


--
-- Name: verification_results verification_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_pkey PRIMARY KEY (id);


--
-- Name: verification_results verification_results_record_id_result_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_record_id_result_no_key UNIQUE (record_id, result_no);


--
-- Name: weather_grid_cells weather_grid_cells_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_grid_cells
    ADD CONSTRAINT weather_grid_cells_pkey PRIMARY KEY (nx, ny);


--
-- Name: weather_observations weather_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations
    ADD CONSTRAINT weather_observations_pkey PRIMARY KEY (nx, ny, observed_at);


--
-- Name: account_actions_source_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_actions_source_ticket_idx ON public.account_actions USING btree (source_ticket_id) WHERE (source_ticket_id IS NOT NULL);


--
-- Name: account_actions_user_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_actions_user_period_idx ON public.account_actions USING btree (user_id, starts_at DESC);


--
-- Name: account_withdrawal_one_open_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_withdrawal_one_open_uq ON public.account_withdrawal_requests USING btree (user_id) WHERE ((status)::text = ANY (ARRAY[('requested'::character varying)::text, ('on_hold'::character varying)::text, ('processing'::character varying)::text]));


--
-- Name: account_withdrawal_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_withdrawal_queue_idx ON public.account_withdrawal_requests USING btree (status, requested_at);


--
-- Name: achievement_backfill_runs_achievement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_backfill_runs_achievement_idx ON public.achievement_backfill_runs USING btree (achievement_id);


--
-- Name: achievement_backfill_runs_admin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_backfill_runs_admin_idx ON public.achievement_backfill_runs USING btree (requested_by_admin_id);


--
-- Name: achievement_backfill_runs_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_backfill_runs_pending_idx ON public.achievement_backfill_runs USING btree (requested_at) WHERE (completed_at IS NULL);


--
-- Name: achievement_versions_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_versions_effective_idx ON public.achievement_versions USING btree (achievement_id, effective_at DESC);


--
-- Name: admin_accounts_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_accounts_email_uq ON public.admin_accounts USING btree (email);


--
-- Name: admin_accounts_login_id_ci_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_accounts_login_id_ci_uq ON public.admin_accounts USING btree (lower((login_id)::text));


--
-- Name: admin_asset_uploads_admin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_asset_uploads_admin_idx ON public.admin_asset_uploads USING btree (created_by_admin_id);


--
-- Name: admin_asset_uploads_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_asset_uploads_owner_idx ON public.admin_asset_uploads USING btree (asset_kind, owner_id);


--
-- Name: admin_audit_actor_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_actor_time_idx ON public.admin_audit_logs USING btree (admin_id, recorded_at DESC);


--
-- Name: admin_audit_target_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_target_time_idx ON public.admin_audit_logs USING btree (target_user_id, recorded_at DESC) WHERE (target_user_id IS NOT NULL);


--
-- Name: admin_idempotency_keys_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_idempotency_keys_created_idx ON public.admin_idempotency_keys USING btree (created_at);


--
-- Name: admin_sessions_admin_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_sessions_admin_expiry_idx ON public.admin_sessions USING btree (admin_id, expires_at);


--
-- Name: ai_mission_recommendations_definition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_mission_recommendations_definition_idx ON public.ai_mission_recommendations USING btree (mission_definition_id) WHERE (mission_definition_id IS NOT NULL);


--
-- Name: ai_mission_recommendations_mission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_mission_recommendations_mission_idx ON public.ai_mission_recommendations USING btree (mission_id) WHERE (mission_id IS NOT NULL);


--
-- Name: ai_mission_recommendations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_mission_recommendations_user_idx ON public.ai_mission_recommendations USING btree (user_id, created_at DESC) WHERE ((status)::text = 'shown'::text);


--
-- Name: ai_plan_proposals_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_plan_proposals_goal_idx ON public.ai_plan_proposals USING btree (goal_id, generated_at DESC);


--
-- Name: ai_plan_proposals_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_plan_proposals_user_idx ON public.ai_plan_proposals USING btree (user_id);


--
-- Name: ai_reports_user_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_reports_user_recent_idx ON public.ai_reports USING btree (user_id, generated_at DESC);


--
-- Name: ai_runs_generation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_runs_generation_uq ON public.ai_analysis_runs USING btree (user_id, run_type, period_start, generation_no) WHERE ((period_start IS NOT NULL) AND ((status)::text <> 'failed'::text));


--
-- Name: ai_runs_one_current_period_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_runs_one_current_period_uq ON public.ai_analysis_runs USING btree (user_id, run_type, period_start) WHERE ((period_start IS NOT NULL) AND ((status)::text <> 'failed'::text) AND (superseded_at IS NULL));


--
-- Name: ai_runs_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_runs_pending_idx ON public.ai_analysis_runs USING btree (requested_at) WHERE ((status)::text = 'requested'::text);


--
-- Name: ai_runs_user_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_runs_user_recent_idx ON public.ai_analysis_runs USING btree (user_id, run_type, requested_at DESC);


--
-- Name: auth_sessions_user_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_sessions_user_expiry_idx ON public.auth_sessions USING btree (user_id, expires_at);


--
-- Name: challenge_daily_missions_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_daily_missions_pending_idx ON public.challenge_daily_missions USING btree (challenge_date) WHERE ((status)::text = 'pending'::text);


--
-- Name: challenge_daily_missions_qualifying_result_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_daily_missions_qualifying_result_idx ON public.challenge_daily_missions USING btree (qualifying_result_id) WHERE (qualifying_result_id IS NOT NULL);


--
-- Name: challenge_daily_missions_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_daily_missions_score_idx ON public.challenge_daily_missions USING btree (challenge_id, status, challenge_date);


--
-- Name: challenge_final_rankings_participation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_final_rankings_participation_idx ON public.challenge_final_rankings USING btree (participation_id) WHERE (participation_id IS NOT NULL);


--
-- Name: challenge_moderation_actions_daily_mission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_moderation_actions_daily_mission_idx ON public.challenge_moderation_actions USING btree (daily_mission_id) WHERE (daily_mission_id IS NOT NULL);


--
-- Name: challenge_moderation_actions_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_moderation_actions_evidence_idx ON public.challenge_moderation_actions USING btree (evidence_result_id) WHERE (evidence_result_id IS NOT NULL);


--
-- Name: challenge_moderation_actions_participation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_moderation_actions_participation_idx ON public.challenge_moderation_actions USING btree (participation_id);


--
-- Name: challenge_one_current_settlement_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX challenge_one_current_settlement_uq ON public.challenge_settlement_runs USING btree (challenge_id) WHERE ((status)::text = 'confirmed'::text);


--
-- Name: challenge_participations_challenge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_participations_challenge_idx ON public.challenge_participations USING btree (challenge_id, status, joined_at);


--
-- Name: challenge_participations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_participations_user_idx ON public.challenge_participations USING btree (user_id);


--
-- Name: challenge_publication_reviews_challenge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_publication_reviews_challenge_idx ON public.challenge_publication_reviews USING btree (challenge_id);


--
-- Name: challenge_publication_reviews_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_publication_reviews_requester_idx ON public.challenge_publication_reviews USING btree (requested_by_user_id) WHERE (requested_by_user_id IS NOT NULL);


--
-- Name: challenge_reward_payment_attempts_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_reward_payment_attempts_due_idx ON public.challenge_reward_payment_attempts USING btree (next_retry_at) WHERE (next_retry_at IS NOT NULL);


--
-- Name: challenge_rule_events_challenge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_rule_events_challenge_idx ON public.challenge_rule_events USING btree (challenge_id);


--
-- Name: challenge_rule_events_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_rule_events_requester_idx ON public.challenge_rule_events USING btree (requested_by_user_id) WHERE (requested_by_user_id IS NOT NULL);


--
-- Name: challenge_settlement_entries_participation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_settlement_entries_participation_idx ON public.challenge_settlement_entries USING btree (participation_id, challenge_id);


--
-- Name: challenge_settlement_rank_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX challenge_settlement_rank_uq ON public.challenge_settlement_entries USING btree (run_id, rank_no) WHERE (rank_no IS NOT NULL);


--
-- Name: challenges_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenges_creator_idx ON public.challenges USING btree (created_by_user_id) WHERE (created_by_user_id IS NOT NULL);


--
-- Name: challenges_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenges_public_idx ON public.challenges USING btree (publication_status, start_date, category_id);


--
-- Name: consent_records_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_records_latest_idx ON public.consent_records USING btree (user_id, document_version_id, recorded_at DESC);


--
-- Name: difficulty_levels_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX difficulty_levels_visible_idx ON public.difficulty_levels USING btree (is_active, display_order, id);


--
-- Name: experience_transactions_award_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX experience_transactions_award_idx ON public.experience_transactions USING btree (experience_award_id, occurred_at);


--
-- Name: experience_transactions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX experience_transactions_user_idx ON public.experience_transactions USING btree (user_id, id);


--
-- Name: goal_categories_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goal_categories_visible_idx ON public.goal_categories USING btree (is_active, display_order, id);


--
-- Name: goals_user_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goals_user_list_idx ON public.goals USING btree (user_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: media_files_owner_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_files_owner_status_idx ON public.media_files USING btree (user_id, upload_status);


--
-- Name: media_files_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_files_record_idx ON public.media_files USING btree (record_id);


--
-- Name: mission_definitions_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_definitions_owner_idx ON public.mission_definitions USING btree (created_by_user_id, created_at DESC) WHERE (created_by_user_id IS NOT NULL);


--
-- Name: mission_definitions_public_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_definitions_public_list_idx ON public.mission_definitions USING btree (publication_status, category_id, difficulty_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: mission_point_awards_first_result_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_point_awards_first_result_idx ON public.mission_point_awards USING btree (first_approved_result_id);


--
-- Name: mission_point_awards_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_point_awards_user_idx ON public.mission_point_awards USING btree (user_id, awarded_at DESC);


--
-- Name: mission_publication_reviews_definition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_publication_reviews_definition_idx ON public.mission_publication_reviews USING btree (definition_id, created_at DESC);


--
-- Name: mission_publication_reviews_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_publication_reviews_requester_idx ON public.mission_publication_reviews USING btree (requested_by_user_id) WHERE (requested_by_user_id IS NOT NULL);


--
-- Name: mission_records_mission_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_records_mission_recent_idx ON public.mission_records USING btree (mission_id, attempt_no DESC);


--
-- Name: mission_records_review_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_records_review_queue_idx ON public.mission_records USING btree (submitted_at) WHERE ((status)::text = 'review_required'::text);


--
-- Name: mission_reward_rates_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reward_rates_effective_idx ON public.mission_reward_rate_versions USING btree (category_id, difficulty_id, effective_at DESC);


--
-- Name: missions_definition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_definition_idx ON public.missions USING btree (definition_id) WHERE (definition_id IS NOT NULL);


--
-- Name: missions_goal_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_goal_status_idx ON public.missions USING btree (goal_id, status) WHERE ((goal_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: missions_step_required_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_step_required_idx ON public.missions USING btree (goal_step_id, is_required, status) WHERE ((goal_step_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: missions_streak_scan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_streak_scan_idx ON public.missions USING btree (scheduled_date) WHERE (((status)::text <> 'cancelled'::text) AND ((source_type)::text <> 'challenge'::text));


--
-- Name: missions_user_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_user_day_idx ON public.missions USING btree (user_id, scheduled_date, status) WHERE (deleted_at IS NULL);


--
-- Name: notice_recipients_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notice_recipients_user_idx ON public.notice_recipients USING btree (user_id);


--
-- Name: notices_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notices_due_idx ON public.notices USING btree (scheduled_at) WHERE ((status)::text = 'scheduled'::text);


--
-- Name: notices_fanout_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notices_fanout_pending_idx ON public.notices USING btree (published_at) WHERE (((status)::text = 'published'::text) AND (fanout_completed_at IS NULL));


--
-- Name: notices_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notices_published_idx ON public.notices USING btree (published_at DESC, id DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: pet_evolution_events_user_pet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_evolution_events_user_pet_idx ON public.pet_evolution_events USING btree (user_pet_id);


--
-- Name: phone_challenges_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phone_challenges_recent_idx ON public.phone_verification_challenges USING btree (phone_e164, purpose, created_at DESC);


--
-- Name: plan_adjustment_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_adjustment_goal_idx ON public.plan_adjustment_proposals USING btree (goal_id, created_at DESC);


--
-- Name: plan_adjustment_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_adjustment_open_idx ON public.plan_adjustment_proposals USING btree (user_id, created_at DESC) WHERE ((status)::text = 'proposed'::text);


--
-- Name: point_recovery_claims_achievement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_recovery_claims_achievement_idx ON public.point_recovery_claims USING btree (user_achievement_id) WHERE (user_achievement_id IS NOT NULL);


--
-- Name: point_recovery_claims_challenge_grant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_recovery_claims_challenge_grant_idx ON public.point_recovery_claims USING btree (challenge_reward_grant_id) WHERE (challenge_reward_grant_id IS NOT NULL);


--
-- Name: point_recovery_claims_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_recovery_claims_pending_idx ON public.point_recovery_claims USING btree (user_id, created_at, id) WHERE ((outstanding_points > 0) AND (NOT is_cancelled));


--
-- Name: point_recovery_claims_streak_award_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_recovery_claims_streak_award_idx ON public.point_recovery_claims USING btree (streak_milestone_award_id) WHERE (streak_milestone_award_id IS NOT NULL);


--
-- Name: point_recovery_one_open_achievement_claim_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX point_recovery_one_open_achievement_claim_uq ON public.point_recovery_claims USING btree (user_achievement_id) WHERE ((user_achievement_id IS NOT NULL) AND (NOT is_cancelled));


--
-- Name: point_recovery_one_open_challenge_claim_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX point_recovery_one_open_challenge_claim_uq ON public.point_recovery_claims USING btree (challenge_reward_grant_id) WHERE ((challenge_reward_grant_id IS NOT NULL) AND (NOT is_cancelled));


--
-- Name: point_recovery_one_open_streak_claim_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX point_recovery_one_open_streak_claim_uq ON public.point_recovery_claims USING btree (streak_milestone_award_id) WHERE ((streak_milestone_award_id IS NOT NULL) AND (NOT is_cancelled));


--
-- Name: point_transactions_recovery_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_transactions_recovery_claim_idx ON public.point_transactions USING btree (recovery_claim_id) WHERE (recovery_claim_id IS NOT NULL);


--
-- Name: point_transactions_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_transactions_source_idx ON public.point_transactions USING btree (source_type, source_id);


--
-- Name: point_transactions_user_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_transactions_user_recent_idx ON public.point_transactions USING btree (user_id, occurred_at DESC, id DESC);


--
-- Name: policy_documents_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX policy_documents_effective_idx ON public.policy_document_versions USING btree (document_type, effective_at DESC) WHERE (published_at IS NOT NULL);


--
-- Name: profiles_nickname_ci_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_nickname_ci_uq ON public.profiles USING btree (lower((nickname)::text));


--
-- Name: push_devices_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_user_active_idx ON public.push_devices USING btree (user_id) WHERE is_active;


--
-- Name: recommendation_messages_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_messages_active_idx ON public.recommendation_messages USING btree (priority DESC, id) WHERE is_active;


--
-- Name: shop_items_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_items_visible_idx ON public.shop_items USING btree (is_active, display_order, id);


--
-- Name: shop_orders_user_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_orders_user_recent_idx ON public.shop_orders USING btree (user_id, created_at DESC, id DESC);


--
-- Name: shop_price_versions_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_price_versions_effective_idx ON public.shop_item_price_versions USING btree (item_id, effective_at DESC);


--
-- Name: streak_days_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_days_pending_idx ON public.streak_days USING btree (streak_date) WHERE ((status)::text = 'pending'::text);


--
-- Name: streak_days_qualifying_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_days_qualifying_record_idx ON public.streak_days USING btree (qualifying_record_id) WHERE (qualifying_record_id IS NOT NULL);


--
-- Name: streak_days_qualifying_result_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_days_qualifying_result_idx ON public.streak_days USING btree (qualifying_result_id) WHERE (qualifying_result_id IS NOT NULL);


--
-- Name: streak_days_user_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_days_user_recent_idx ON public.streak_days USING btree (user_id, streak_date DESC);


--
-- Name: streak_milestone_awards_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_milestone_awards_user_idx ON public.streak_milestone_awards USING btree (user_id, first_achieved_date DESC);


--
-- Name: streak_milestone_policies_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX streak_milestone_policies_effective_idx ON public.streak_milestone_policy_versions USING btree (target_success_days, effective_at DESC);


--
-- Name: support_open_report_challenge_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX support_open_report_challenge_uq ON public.support_tickets USING btree (reporter_user_id, target_challenge_id) WHERE (((ticket_type)::text = 'report'::text) AND ((status)::text <> 'completed'::text) AND (reporter_user_id IS NOT NULL) AND (target_challenge_id IS NOT NULL));


--
-- Name: support_open_report_mission_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX support_open_report_mission_uq ON public.support_tickets USING btree (reporter_user_id, target_mission_definition_id) WHERE (((ticket_type)::text = 'report'::text) AND ((status)::text <> 'completed'::text) AND (reporter_user_id IS NOT NULL) AND (target_mission_definition_id IS NOT NULL));


--
-- Name: support_open_report_user_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX support_open_report_user_uq ON public.support_tickets USING btree (reporter_user_id, target_user_id) WHERE (((ticket_type)::text = 'report'::text) AND ((status)::text <> 'completed'::text) AND (reporter_user_id IS NOT NULL) AND (target_user_id IS NOT NULL));


--
-- Name: support_ticket_events_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_events_ticket_idx ON public.support_ticket_events USING btree (ticket_id, created_at, id);


--
-- Name: support_ticket_resolutions_account_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_resolutions_account_action_idx ON public.support_ticket_resolutions USING btree (account_action_id) WHERE (account_action_id IS NOT NULL);


--
-- Name: support_tickets_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_queue_idx ON public.support_tickets USING btree (status, received_at, id) WHERE ((status)::text <> 'completed'::text);


--
-- Name: support_tickets_reporter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_reporter_idx ON public.support_tickets USING btree (reporter_user_id, received_at DESC) WHERE (reporter_user_id IS NOT NULL);


--
-- Name: support_tickets_target_challenge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_target_challenge_idx ON public.support_tickets USING btree (target_challenge_id) WHERE (target_challenge_id IS NOT NULL);


--
-- Name: support_tickets_target_mission_definition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_target_mission_definition_idx ON public.support_tickets USING btree (target_mission_definition_id) WHERE (target_mission_definition_id IS NOT NULL);


--
-- Name: support_tickets_target_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_target_user_idx ON public.support_tickets USING btree (target_user_id) WHERE (target_user_id IS NOT NULL);


--
-- Name: user_achievement_events_first_earned_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_achievement_events_first_earned_uq ON public.user_achievement_events USING btree (user_achievement_id) WHERE ((event_type)::text = 'earned'::text);


--
-- Name: user_achievement_events_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_achievement_events_recent_idx ON public.user_achievement_events USING btree (user_achievement_id, occurred_at DESC);


--
-- Name: user_achievements_owner_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_achievements_owner_status_idx ON public.user_achievements USING btree (user_id, status, awarded_at DESC);


--
-- Name: user_idempotency_keys_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_idempotency_keys_created_idx ON public.user_idempotency_keys USING btree (created_at);


--
-- Name: user_inventory_events_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_inventory_events_user_idx ON public.user_inventory_events USING btree (user_id, occurred_at DESC, id DESC);


--
-- Name: user_notifications_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_inbox_idx ON public.user_notifications USING btree (user_id, created_at DESC, id DESC);


--
-- Name: user_notifications_notice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_notice_idx ON public.user_notifications USING btree (notice_id) WHERE (notice_id IS NOT NULL);


--
-- Name: user_notifications_push_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_push_pending_idx ON public.user_notifications USING btree (created_at) WHERE ((push_status)::text = 'pending'::text);


--
-- Name: user_notifications_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_unread_idx ON public.user_notifications USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: user_pets_nickname_ci_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_pets_nickname_ci_uq ON public.user_pets USING btree (user_id, lower((nickname)::text));


--
-- Name: verification_appeals_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_appeals_queue_idx ON public.verification_appeals USING btree (filed_at) WHERE ((status)::text = 'open'::text);


--
-- Name: verification_appeals_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_appeals_record_idx ON public.verification_appeals USING btree (record_id, filed_by_user_id);


--
-- Name: verification_appeals_resolution_result_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_appeals_resolution_result_idx ON public.verification_appeals USING btree (resolution_result_id) WHERE (resolution_result_id IS NOT NULL);


--
-- Name: verification_criteria_current_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_criteria_current_idx ON public.verification_criteria_versions USING btree (category_id, verification_method, effective_at DESC);


--
-- Name: verification_results_ingest_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX verification_results_ingest_key_uq ON public.verification_results USING btree (ingest_key) WHERE (ingest_key IS NOT NULL);


--
-- Name: verification_results_one_current_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX verification_results_one_current_uq ON public.verification_results USING btree (record_id) WHERE is_current;


--
-- Name: verification_results_record_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_results_record_recent_idx ON public.verification_results USING btree (record_id, result_no DESC);


--
-- Name: weather_grid_cells_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weather_grid_cells_recent_idx ON public.weather_grid_cells USING btree (last_requested_at);


--
-- Name: weather_observations_observed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weather_observations_observed_idx ON public.weather_observations USING btree (observed_at);


--
-- Name: challenge_live_rankings _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.challenge_live_rankings AS
 SELECT cp.challenge_id,
    cp.id AS participation_id,
    cp.user_id,
    pf.nickname AS display_name,
    (count(d.id) FILTER (WHERE ((d.status)::text = 'success'::text)))::integer AS successful_days,
    ((count(d.id) FILTER (WHERE ((d.status)::text = 'success'::text)) * 100))::integer AS score,
    last_success.submitted_at AS last_qualifying_submitted_at,
    row_number() OVER (PARTITION BY cp.challenge_id ORDER BY (count(d.id) FILTER (WHERE ((d.status)::text = 'success'::text))) DESC, last_success.submitted_at, cp.joined_at, cp.id) AS rank_no
   FROM (((public.challenge_participations cp
     JOIN public.profiles pf ON ((pf.user_id = cp.user_id)))
     LEFT JOIN public.challenge_daily_missions d ON ((d.participation_id = cp.id)))
     LEFT JOIN LATERAL ( SELECT mr.submitted_at
           FROM (public.challenge_daily_missions d2
             JOIN public.mission_records mr ON ((mr.id = d2.qualifying_record_id)))
          WHERE ((d2.participation_id = cp.id) AND ((d2.status)::text = 'success'::text))
          ORDER BY d2.challenge_date DESC
         LIMIT 1) last_success ON (true))
  WHERE ((cp.status)::text <> ALL (ARRAY[('withdrawn'::character varying)::text, ('disqualified'::character varying)::text]))
  GROUP BY cp.challenge_id, cp.id, cp.user_id, pf.nickname, last_success.submitted_at;


--
-- Name: achievement_badge_images achievement_badge_images_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER achievement_badge_images_no_update BEFORE UPDATE ON public.achievement_badge_images FOR EACH ROW EXECUTE FUNCTION public.protect_badge_image();


--
-- Name: achievement_versions achievement_versions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER achievement_versions_no_change BEFORE DELETE OR UPDATE ON public.achievement_versions FOR EACH ROW EXECUTE FUNCTION public.protect_achievement_version();


--
-- Name: admin_idempotency_keys admin_idempotency_keys_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_idempotency_keys_guard_before_update BEFORE UPDATE ON public.admin_idempotency_keys FOR EACH ROW EXECUTE FUNCTION public.guard_admin_idempotency_key();


--
-- Name: ai_mission_recommendations ai_recommendations_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_recommendations_guard_before_insert BEFORE INSERT ON public.ai_mission_recommendations FOR EACH ROW EXECUTE FUNCTION public.guard_ai_result_insert();


--
-- Name: ai_mission_recommendations ai_recommendations_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_recommendations_guard_before_update BEFORE UPDATE ON public.ai_mission_recommendations FOR EACH ROW EXECUTE FUNCTION public.guard_ai_decision_update();


--
-- Name: ai_reports ai_reports_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_reports_guard_before_insert BEFORE INSERT ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION public.guard_ai_result_insert();


--
-- Name: ai_reports ai_reports_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_reports_guard_before_update BEFORE UPDATE ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION public.guard_ai_report_update();


--
-- Name: ai_analysis_runs ai_runs_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_runs_guard_before_update BEFORE UPDATE ON public.ai_analysis_runs FOR EACH ROW EXECUTE FUNCTION public.guard_ai_run_update();


--
-- Name: challenge_daily_missions challenge_daily_missions_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_daily_missions_guard BEFORE INSERT OR UPDATE ON public.challenge_daily_missions FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_daily_mission();


--
-- Name: challenge_final_rankings challenge_final_rankings_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_final_rankings_guard BEFORE INSERT OR UPDATE ON public.challenge_final_rankings FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_final_ranking();


--
-- Name: challenge_participations challenge_participation_anonymize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_participation_anonymize BEFORE DELETE ON public.challenge_participations FOR EACH ROW EXECUTE FUNCTION public.anonymize_challenge_ranking();


--
-- Name: challenge_participations challenge_participations_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_participations_guard BEFORE INSERT OR UPDATE ON public.challenge_participations FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_participation();


--
-- Name: challenge_reward_grants challenge_reward_grants_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_reward_grants_guard BEFORE INSERT OR UPDATE ON public.challenge_reward_grants FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_reward_grant();


--
-- Name: challenge_reward_packages challenge_reward_packages_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_reward_packages_guard BEFORE INSERT OR UPDATE ON public.challenge_reward_packages FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_reward_package();


--
-- Name: challenge_settlement_entries challenge_settlement_entries_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_settlement_entries_guard BEFORE INSERT OR UPDATE ON public.challenge_settlement_entries FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_settlement_entry();


--
-- Name: challenge_settlement_runs challenge_settlement_runs_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_settlement_runs_guard BEFORE INSERT OR UPDATE ON public.challenge_settlement_runs FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_settlement_run();


--
-- Name: challenges challenges_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenges_guard BEFORE INSERT OR UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.guard_challenge();


--
-- Name: experience_awards experience_awards_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER experience_awards_guard BEFORE INSERT OR UPDATE ON public.experience_awards FOR EACH ROW EXECUTE FUNCTION public.guard_experience_award();


--
-- Name: experience_transactions experience_transactions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER experience_transactions_no_change BEFORE DELETE OR UPDATE ON public.experience_transactions FOR EACH ROW EXECUTE FUNCTION public.protect_experience_transaction();


--
-- Name: goals goals_cancel_unstarted_missions_after_delete_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER goals_cancel_unstarted_missions_after_delete_mark AFTER UPDATE OF deleted_at ON public.goals FOR EACH ROW EXECUTE FUNCTION public.cancel_unstarted_missions_for_deleted_goal();


--
-- Name: mission_point_awards mission_point_awards_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_point_awards_guard_before_insert BEFORE INSERT ON public.mission_point_awards FOR EACH ROW EXECUTE FUNCTION public.guard_mission_point_award();


--
-- Name: mission_point_awards mission_point_awards_lock_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_point_awards_lock_before_update BEFORE UPDATE ON public.mission_point_awards FOR EACH ROW EXECUTE FUNCTION public.lock_mission_point_award_identity();


--
-- Name: mission_records mission_records_guard_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_records_guard_before_write BEFORE INSERT OR UPDATE ON public.mission_records FOR EACH ROW EXECUTE FUNCTION public.guard_mission_record_write();


--
-- Name: mission_records mission_records_pet_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_records_pet_snapshot BEFORE INSERT OR UPDATE ON public.mission_records FOR EACH ROW EXECUTE FUNCTION public.snapshot_mission_pet();


--
-- Name: mission_reward_rate_versions mission_reward_rates_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_reward_rates_no_change BEFORE DELETE OR UPDATE ON public.mission_reward_rate_versions FOR EACH ROW EXECUTE FUNCTION public.protect_mission_reward_rate();


--
-- Name: missions missions_lock_reward_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_lock_reward_before_update BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.lock_mission_reward();


--
-- Name: missions missions_lock_rules_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_lock_rules_before_update BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.lock_started_mission_rules();


--
-- Name: missions missions_lock_xp_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_lock_xp_before_update BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.lock_mission_xp();


--
-- Name: missions missions_validate_reward_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_validate_reward_before_insert BEFORE INSERT ON public.missions FOR EACH ROW EXECUTE FUNCTION public.validate_mission_reward();


--
-- Name: missions missions_validate_source_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_validate_source_before_write BEFORE INSERT OR UPDATE OF definition_id, source_proposal_id, source_type, user_id ON public.missions FOR EACH ROW EXECUTE FUNCTION public.validate_mission_source();


--
-- Name: missions missions_validate_xp_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_validate_xp_before_insert BEFORE INSERT ON public.missions FOR EACH ROW EXECUTE FUNCTION public.validate_mission_xp();


--
-- Name: notice_recipients notice_recipients_guard_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notice_recipients_guard_before_write BEFORE INSERT OR DELETE ON public.notice_recipients FOR EACH ROW EXECUTE FUNCTION public.guard_notice_recipients();


--
-- Name: notices notices_guard_before_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notices_guard_before_delete BEFORE DELETE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.guard_notice_delete();


--
-- Name: notices notices_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notices_guard_before_update BEFORE UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.guard_notice_update();


--
-- Name: pet_level_policy_versions pet_level_policy_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_level_policy_no_change BEFORE DELETE OR UPDATE ON public.pet_level_policy_versions FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_species_versions pet_species_versions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_species_versions_no_change BEFORE DELETE OR UPDATE ON public.pet_species_versions FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_stage_dialogues pet_stage_dialogues_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_stage_dialogues_no_change BEFORE DELETE OR UPDATE ON public.pet_stage_dialogues FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_stage_images pet_stage_images_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_stage_images_no_change BEFORE DELETE OR UPDATE ON public.pet_stage_images FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_stage_versions pet_stage_sequence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_stage_sequence BEFORE INSERT ON public.pet_stage_versions FOR EACH ROW EXECUTE FUNCTION public.check_pet_stage_sequence();


--
-- Name: pet_stage_versions pet_stage_versions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_stage_versions_no_change BEFORE DELETE OR UPDATE ON public.pet_stage_versions FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_level_thresholds pet_threshold_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_threshold_no_change BEFORE DELETE OR UPDATE ON public.pet_level_thresholds FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: pet_level_thresholds pet_threshold_sequence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pet_threshold_sequence BEFORE INSERT ON public.pet_level_thresholds FOR EACH ROW EXECUTE FUNCTION public.check_xp_threshold_sequence();


--
-- Name: plan_adjustment_proposals plan_adjustment_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plan_adjustment_guard_before_insert BEFORE INSERT ON public.plan_adjustment_proposals FOR EACH ROW EXECUTE FUNCTION public.guard_ai_result_insert();


--
-- Name: plan_adjustment_proposals plan_adjustment_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plan_adjustment_guard_before_update BEFORE UPDATE ON public.plan_adjustment_proposals FOR EACH ROW EXECUTE FUNCTION public.guard_ai_decision_update();


--
-- Name: point_monthly_cap_policies point_cap_policies_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_cap_policies_no_change BEFORE DELETE OR UPDATE ON public.point_monthly_cap_policies FOR EACH ROW EXECUTE FUNCTION public.protect_mission_reward_rate();


--
-- Name: point_monthly_cap_policies point_cap_policy_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_cap_policy_guard_before_insert BEFORE INSERT ON public.point_monthly_cap_policies FOR EACH ROW EXECUTE FUNCTION public.guard_point_cap_policy();


--
-- Name: point_recovery_claims point_recovery_challenge_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_recovery_challenge_source BEFORE INSERT ON public.point_recovery_claims FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_point_recovery_claim();


--
-- Name: point_recovery_claims point_recovery_claims_streak_achievement_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_recovery_claims_streak_achievement_source BEFORE INSERT ON public.point_recovery_claims FOR EACH ROW EXECUTE FUNCTION public.guard_point_recovery_claim_source();


--
-- Name: point_transactions point_transactions_achievement_source_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_transactions_achievement_source_before_insert BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_achievement_point_source();


--
-- Name: point_transactions point_transactions_challenge_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_transactions_challenge_source BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_point_source();


--
-- Name: point_transactions point_transactions_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_transactions_guard_before_insert BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_point_transaction();


--
-- Name: point_transactions point_transactions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_transactions_no_change BEFORE DELETE OR UPDATE ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.protect_point_transaction();


--
-- Name: point_transactions point_transactions_streak_source_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_transactions_streak_source_before_insert BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_streak_point_source();


--
-- Name: profiles profiles_guard_representative_badge_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_guard_representative_badge_before_write BEFORE INSERT OR UPDATE OF representative_achievement_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_representative_badge();


--
-- Name: shop_orders shop_orders_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_orders_guard_before_insert BEFORE INSERT ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.guard_shop_order_insert();


--
-- Name: shop_orders shop_orders_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_orders_guard_before_update BEFORE UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.guard_shop_order_update();


--
-- Name: shop_item_price_versions shop_price_versions_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_price_versions_no_change BEFORE DELETE OR UPDATE ON public.shop_item_price_versions FOR EACH ROW EXECUTE FUNCTION public.protect_shop_price_version();


--
-- Name: streak_days streak_days_reject_challenge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_days_reject_challenge BEFORE INSERT OR UPDATE ON public.streak_days FOR EACH ROW EXECUTE FUNCTION public.reject_challenge_streak_day();


--
-- Name: streak_days streak_days_validate_success_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_days_validate_success_before_write BEFORE INSERT OR UPDATE OF status, qualifying_mission_id, qualifying_record_id, qualifying_result_id, streak_date ON public.streak_days FOR EACH ROW EXECUTE FUNCTION public.validate_streak_success();


--
-- Name: streak_milestone_awards streak_milestone_awards_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_milestone_awards_guard_before_insert BEFORE INSERT ON public.streak_milestone_awards FOR EACH ROW EXECUTE FUNCTION public.guard_streak_milestone_award();


--
-- Name: streak_milestone_awards streak_milestone_awards_lock_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_milestone_awards_lock_before_update BEFORE UPDATE ON public.streak_milestone_awards FOR EACH ROW EXECUTE FUNCTION public.lock_streak_milestone_award_identity();


--
-- Name: streak_milestone_awards streak_milestone_awards_no_direct_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_milestone_awards_no_direct_delete BEFORE DELETE ON public.streak_milestone_awards FOR EACH ROW EXECUTE FUNCTION public.protect_streak_milestone_award_delete();


--
-- Name: streak_milestone_policy_versions streak_milestone_policies_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streak_milestone_policies_no_change BEFORE DELETE OR UPDATE ON public.streak_milestone_policy_versions FOR EACH ROW EXECUTE FUNCTION public.protect_streak_milestone_policy();


--
-- Name: support_ticket_resolutions support_resolutions_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_resolutions_guard_before_insert BEFORE INSERT ON public.support_ticket_resolutions FOR EACH ROW EXECUTE FUNCTION public.guard_support_resolution();


--
-- Name: support_ticket_resolutions support_resolutions_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_resolutions_guard_before_update BEFORE UPDATE ON public.support_ticket_resolutions FOR EACH ROW EXECUTE FUNCTION public.guard_support_resolution_update();


--
-- Name: support_ticket_resolutions support_resolutions_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_resolutions_no_delete BEFORE DELETE ON public.support_ticket_resolutions FOR EACH ROW EXECUTE FUNCTION public.protect_support_history();


--
-- Name: support_ticket_events support_ticket_events_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_ticket_events_no_change BEFORE DELETE OR UPDATE ON public.support_ticket_events FOR EACH ROW EXECUTE FUNCTION public.protect_support_history();


--
-- Name: support_tickets support_tickets_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_tickets_guard_before_update BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.guard_support_ticket_update();


--
-- Name: user_achievement_events user_achievement_events_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievement_events_guard_before_insert BEFORE INSERT ON public.user_achievement_events FOR EACH ROW EXECUTE FUNCTION public.guard_user_achievement_event();


--
-- Name: user_achievement_events user_achievement_events_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievement_events_no_change BEFORE DELETE OR UPDATE ON public.user_achievement_events FOR EACH ROW EXECUTE FUNCTION public.protect_user_achievement_event();


--
-- Name: user_achievements user_achievements_clear_representative_after_revoke; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievements_clear_representative_after_revoke AFTER UPDATE OF status ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.clear_revoked_representative_badge();


--
-- Name: user_achievements user_achievements_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievements_guard_before_insert BEFORE INSERT ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.guard_user_achievement();


--
-- Name: user_achievements user_achievements_lock_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievements_lock_before_update BEFORE UPDATE ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.lock_user_achievement_identity();


--
-- Name: user_achievements user_achievements_no_direct_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievements_no_direct_delete BEFORE DELETE ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.protect_user_achievement_delete();


--
-- Name: user_achievements user_achievements_paid_points_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_achievements_paid_points_guard BEFORE UPDATE ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.guard_user_achievement_paid_points();


--
-- Name: user_experience user_experience_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_experience_guard BEFORE INSERT OR UPDATE ON public.user_experience FOR EACH ROW EXECUTE FUNCTION public.guard_user_experience();


--
-- Name: user_idempotency_keys user_idempotency_keys_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_idempotency_keys_guard_before_update BEFORE UPDATE ON public.user_idempotency_keys FOR EACH ROW EXECUTE FUNCTION public.guard_user_idempotency_key();


--
-- Name: user_inventory_events user_inventory_events_apply_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_inventory_events_apply_after_insert AFTER INSERT ON public.user_inventory_events FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_event();


--
-- Name: user_inventory_events user_inventory_events_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_inventory_events_no_change BEFORE DELETE OR UPDATE ON public.user_inventory_events FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_event();


--
-- Name: user_level_policy_versions user_level_policy_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_level_policy_no_change BEFORE DELETE OR UPDATE ON public.user_level_policy_versions FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: user_notifications user_notifications_guard_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_notifications_guard_before_insert BEFORE INSERT ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION public.guard_user_notification_insert();


--
-- Name: user_notifications user_notifications_guard_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_notifications_guard_before_update BEFORE UPDATE ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION public.guard_user_notification_update();


--
-- Name: user_pets user_pets_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_pets_guard BEFORE INSERT OR UPDATE ON public.user_pets FOR EACH ROW EXECUTE FUNCTION public.guard_user_pet();


--
-- Name: user_pets user_pets_no_direct_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_pets_no_direct_delete BEFORE DELETE ON public.user_pets FOR EACH ROW EXECUTE FUNCTION public.protect_user_pet_delete();


--
-- Name: user_level_thresholds user_threshold_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_threshold_no_change BEFORE DELETE OR UPDATE ON public.user_level_thresholds FOR EACH ROW EXECUTE FUNCTION public.protect_xp_policy();


--
-- Name: user_level_thresholds user_threshold_sequence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_threshold_sequence BEFORE INSERT ON public.user_level_thresholds FOR EACH ROW EXECUTE FUNCTION public.check_xp_threshold_sequence();


--
-- Name: users users_delete_inquiries_before_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_delete_inquiries_before_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.delete_user_inquiries();


--
-- Name: users users_require_r2_cleanup_before_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_require_r2_cleanup_before_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.require_r2_cleanup_before_user_delete();


--
-- Name: users users_scrub_account_logs_before_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_scrub_account_logs_before_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.scrub_user_account_logs();


--
-- Name: users users_scrub_challenge_logs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_scrub_challenge_logs BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.scrub_user_challenge_logs();


--
-- Name: users users_scrub_mission_reviews_before_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_scrub_mission_reviews_before_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.scrub_user_mission_reviews();


--
-- Name: verification_appeals verification_appeals_guard_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_appeals_guard_before_write BEFORE INSERT OR UPDATE OF status, resolution_result_id ON public.verification_appeals FOR EACH ROW EXECUTE FUNCTION public.guard_verification_appeal();


--
-- Name: verification_criteria_versions verification_criteria_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_criteria_no_change BEFORE DELETE OR UPDATE ON public.verification_criteria_versions FOR EACH ROW EXECUTE FUNCTION public.protect_verification_criteria_version();


--
-- Name: verification_results verification_results_protect_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_results_protect_before_update BEFORE UPDATE ON public.verification_results FOR EACH ROW EXECUTE FUNCTION public.protect_verification_result();


--
-- Name: verification_results verification_results_validate_criteria_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_results_validate_criteria_before_insert BEFORE INSERT ON public.verification_results FOR EACH ROW EXECUTE FUNCTION public.validate_verification_result_criteria();


--
-- Name: account_actions account_actions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_actions
    ADD CONSTRAINT account_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: account_actions account_actions_source_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_actions
    ADD CONSTRAINT account_actions_source_ticket_id_fkey FOREIGN KEY (source_ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL;


--
-- Name: account_actions account_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_actions
    ADD CONSTRAINT account_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: account_withdrawal_requests account_withdrawal_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_withdrawal_requests
    ADD CONSTRAINT account_withdrawal_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: account_withdrawal_requests account_withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_withdrawal_requests
    ADD CONSTRAINT account_withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: achievement_backfill_runs achievement_backfill_runs_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_backfill_runs
    ADD CONSTRAINT achievement_backfill_runs_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE RESTRICT;


--
-- Name: achievement_backfill_runs achievement_backfill_runs_requested_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_backfill_runs
    ADD CONSTRAINT achievement_backfill_runs_requested_by_admin_id_fkey FOREIGN KEY (requested_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: achievement_backfill_runs achievement_backfill_runs_version_id_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_backfill_runs
    ADD CONSTRAINT achievement_backfill_runs_version_id_achievement_id_fkey FOREIGN KEY (version_id, achievement_id) REFERENCES public.achievement_versions(id, achievement_id) ON DELETE RESTRICT;


--
-- Name: achievement_badge_images achievement_badge_images_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE RESTRICT;


--
-- Name: achievement_badge_images achievement_badge_images_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_badge_images
    ADD CONSTRAINT achievement_badge_images_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: achievement_definitions achievement_definitions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: achievement_versions achievement_versions_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE RESTRICT;


--
-- Name: achievement_versions achievement_versions_badge_image_id_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_badge_image_id_achievement_id_fkey FOREIGN KEY (badge_image_id, achievement_id) REFERENCES public.achievement_badge_images(id, achievement_id) ON DELETE RESTRICT;


--
-- Name: achievement_versions achievement_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: achievement_versions achievement_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_versions
    ADD CONSTRAINT achievement_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: admin_asset_uploads admin_asset_uploads_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_asset_uploads
    ADD CONSTRAINT admin_asset_uploads_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: admin_audit_logs admin_audit_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: admin_audit_logs admin_audit_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_idempotency_keys admin_idempotency_keys_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_idempotency_keys
    ADD CONSTRAINT admin_idempotency_keys_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: admin_sessions admin_sessions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE CASCADE;


--
-- Name: ai_analysis_runs ai_analysis_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_mission_recommendations ai_mission_recommendations_mission_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_mission_recommendations_mission_definition_id_fkey FOREIGN KEY (mission_definition_id) REFERENCES public.mission_definitions(id) ON DELETE CASCADE;


--
-- Name: ai_mission_recommendations ai_mission_recommendations_run_id_run_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_mission_recommendations_run_id_run_type_fkey FOREIGN KEY (run_id, run_type) REFERENCES public.ai_analysis_runs(id, run_type) ON DELETE CASCADE;


--
-- Name: ai_mission_recommendations ai_mission_recommendations_run_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_mission_recommendations_run_id_user_id_fkey FOREIGN KEY (run_id, user_id) REFERENCES public.ai_analysis_runs(id, user_id) ON DELETE CASCADE;


--
-- Name: ai_plan_proposals ai_plan_proposals_goal_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_plan_proposals
    ADD CONSTRAINT ai_plan_proposals_goal_id_user_id_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE CASCADE;


--
-- Name: ai_plan_proposals ai_plan_proposals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_plan_proposals
    ADD CONSTRAINT ai_plan_proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_mission_recommendations ai_recommendation_mission_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_mission_recommendations
    ADD CONSTRAINT ai_recommendation_mission_fk FOREIGN KEY (mission_id, user_id) REFERENCES public.missions(id, user_id) ON DELETE CASCADE;


--
-- Name: ai_reports ai_reports_run_id_run_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT ai_reports_run_id_run_type_fkey FOREIGN KEY (run_id, run_type) REFERENCES public.ai_analysis_runs(id, run_type) ON DELETE CASCADE;


--
-- Name: ai_reports ai_reports_run_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT ai_reports_run_id_user_id_fkey FOREIGN KEY (run_id, user_id) REFERENCES public.ai_analysis_runs(id, user_id) ON DELETE CASCADE;


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: challenge_daily_missions challenge_daily_missions_mission_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_mission_id_user_id_fkey FOREIGN KEY (mission_id, user_id) REFERENCES public.missions(id, user_id) ON DELETE CASCADE;


--
-- Name: challenge_daily_missions challenge_daily_missions_participation_id_challenge_id_use_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_participation_id_challenge_id_use_fkey FOREIGN KEY (participation_id, challenge_id, user_id) REFERENCES public.challenge_participations(id, challenge_id, user_id) ON DELETE CASCADE;


--
-- Name: challenge_daily_missions challenge_daily_missions_qualifying_record_id_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_qualifying_record_id_mission_id_fkey FOREIGN KEY (qualifying_record_id, mission_id) REFERENCES public.mission_records(id, mission_id) ON DELETE CASCADE;


--
-- Name: challenge_daily_missions challenge_daily_missions_qualifying_result_id_qualifying_r_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_missions
    ADD CONSTRAINT challenge_daily_missions_qualifying_result_id_qualifying_r_fkey FOREIGN KEY (qualifying_result_id, qualifying_record_id) REFERENCES public.verification_results(id, record_id) ON DELETE CASCADE;


--
-- Name: challenge_final_rankings challenge_final_rankings_participation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_final_rankings
    ADD CONSTRAINT challenge_final_rankings_participation_id_fkey FOREIGN KEY (participation_id) REFERENCES public.challenge_participations(id) ON DELETE SET NULL;


--
-- Name: challenge_final_rankings challenge_final_rankings_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_final_rankings
    ADD CONSTRAINT challenge_final_rankings_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.challenge_settlement_runs(id) ON DELETE RESTRICT;


--
-- Name: challenge_moderation_actions challenge_moderation_actions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_moderation_actions
    ADD CONSTRAINT challenge_moderation_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: challenge_moderation_actions challenge_moderation_actions_daily_mission_id_participatio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_moderation_actions
    ADD CONSTRAINT challenge_moderation_actions_daily_mission_id_participatio_fkey FOREIGN KEY (daily_mission_id, participation_id) REFERENCES public.challenge_daily_missions(id, participation_id) ON DELETE CASCADE;


--
-- Name: challenge_moderation_actions challenge_moderation_actions_evidence_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_moderation_actions
    ADD CONSTRAINT challenge_moderation_actions_evidence_result_id_fkey FOREIGN KEY (evidence_result_id) REFERENCES public.verification_results(id) ON DELETE SET NULL;


--
-- Name: challenge_moderation_actions challenge_moderation_actions_participation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_moderation_actions
    ADD CONSTRAINT challenge_moderation_actions_participation_id_fkey FOREIGN KEY (participation_id) REFERENCES public.challenge_participations(id) ON DELETE CASCADE;


--
-- Name: challenge_participations challenge_participations_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participations challenge_participations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participations
    ADD CONSTRAINT challenge_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: challenge_publication_reviews challenge_publication_reviews_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_publication_reviews
    ADD CONSTRAINT challenge_publication_reviews_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_publication_reviews challenge_publication_reviews_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_publication_reviews
    ADD CONSTRAINT challenge_publication_reviews_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: challenge_publication_reviews challenge_publication_reviews_reviewed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_publication_reviews
    ADD CONSTRAINT challenge_publication_reviews_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: challenge_reward_grants challenge_reward_grants_badge_grant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_badge_grant_id_user_id_fkey FOREIGN KEY (badge_grant_id, user_id) REFERENCES public.user_achievements(id, user_id) ON DELETE RESTRICT;


--
-- Name: challenge_reward_grants challenge_reward_grants_first_settlement_run_id_challenge__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_first_settlement_run_id_challenge__fkey FOREIGN KEY (first_settlement_run_id, challenge_id) REFERENCES public.challenge_settlement_runs(id, challenge_id) ON DELETE RESTRICT;


--
-- Name: challenge_reward_grants challenge_reward_grants_participation_id_challenge_id_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_participation_id_challenge_id_user_fkey FOREIGN KEY (participation_id, challenge_id, user_id) REFERENCES public.challenge_participations(id, challenge_id, user_id) ON DELETE CASCADE;


--
-- Name: challenge_reward_grants challenge_reward_grants_recipient_pet_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_grants
    ADD CONSTRAINT challenge_reward_grants_recipient_pet_id_user_id_fkey FOREIGN KEY (recipient_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE RESTRICT;


--
-- Name: challenge_reward_packages challenge_reward_packages_badge_achievement_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_packages
    ADD CONSTRAINT challenge_reward_packages_badge_achievement_version_id_fkey FOREIGN KEY (badge_achievement_version_id) REFERENCES public.achievement_versions(id) ON DELETE RESTRICT;


--
-- Name: challenge_reward_packages challenge_reward_packages_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_packages
    ADD CONSTRAINT challenge_reward_packages_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_reward_payment_attempts challenge_reward_payment_attempts_run_id_participation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_reward_payment_attempts
    ADD CONSTRAINT challenge_reward_payment_attempts_run_id_participation_id_fkey FOREIGN KEY (run_id, participation_id) REFERENCES public.challenge_settlement_entries(run_id, participation_id) ON DELETE CASCADE;


--
-- Name: challenge_rule_events challenge_rule_events_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_rule_events
    ADD CONSTRAINT challenge_rule_events_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: challenge_rule_events challenge_rule_events_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_rule_events
    ADD CONSTRAINT challenge_rule_events_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_rule_events challenge_rule_events_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_rule_events
    ADD CONSTRAINT challenge_rule_events_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: challenge_score_snapshots challenge_score_snapshots_participation_id_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_score_snapshots
    ADD CONSTRAINT challenge_score_snapshots_participation_id_challenge_id_fkey FOREIGN KEY (participation_id, challenge_id) REFERENCES public.challenge_participations(id, challenge_id) ON DELETE CASCADE;


--
-- Name: challenge_settlement_entries challenge_settlement_entries_participation_id_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_entries
    ADD CONSTRAINT challenge_settlement_entries_participation_id_challenge_id_fkey FOREIGN KEY (participation_id, challenge_id) REFERENCES public.challenge_participations(id, challenge_id) ON DELETE CASCADE;


--
-- Name: challenge_settlement_entries challenge_settlement_entries_run_id_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_entries
    ADD CONSTRAINT challenge_settlement_entries_run_id_challenge_id_fkey FOREIGN KEY (run_id, challenge_id) REFERENCES public.challenge_settlement_runs(id, challenge_id) ON DELETE CASCADE;


--
-- Name: challenge_settlement_runs challenge_settlement_runs_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_runs
    ADD CONSTRAINT challenge_settlement_runs_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE RESTRICT;


--
-- Name: challenge_settlement_runs challenge_settlement_runs_confirmed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_settlement_runs
    ADD CONSTRAINT challenge_settlement_runs_confirmed_by_admin_id_fkey FOREIGN KEY (confirmed_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: challenges challenges_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: challenges challenges_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: challenges challenges_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_difficulty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_difficulty_id_fkey FOREIGN KEY (difficulty_id) REFERENCES public.difficulty_levels(id) ON DELETE RESTRICT;


--
-- Name: consent_records consent_records_document_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_document_version_id_fkey FOREIGN KEY (document_version_id) REFERENCES public.policy_document_versions(id) ON DELETE RESTRICT;


--
-- Name: consent_records consent_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: experience_awards experience_awards_pet_species_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_pet_species_version_id_fkey FOREIGN KEY (pet_species_version_id) REFERENCES public.pet_species_versions(id) ON DELETE RESTRICT;


--
-- Name: experience_awards experience_awards_recipient_pet_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_recipient_pet_id_user_id_fkey FOREIGN KEY (recipient_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE RESTRICT;


--
-- Name: experience_awards experience_awards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_awards
    ADD CONSTRAINT experience_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: experience_transactions experience_transactions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: experience_transactions experience_transactions_experience_award_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_experience_award_id_user_id_fkey FOREIGN KEY (experience_award_id, user_id) REFERENCES public.experience_awards(id, user_id) ON DELETE CASCADE;


--
-- Name: experience_transactions experience_transactions_original_transaction_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_original_transaction_id_user_id_fkey FOREIGN KEY (original_transaction_id, user_id) REFERENCES public.experience_transactions(id, user_id) ON DELETE CASCADE;


--
-- Name: experience_transactions experience_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: experience_transactions experience_transactions_user_pet_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experience_transactions
    ADD CONSTRAINT experience_transactions_user_pet_id_user_id_fkey FOREIGN KEY (user_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE CASCADE;


--
-- Name: goal_steps goal_steps_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_steps
    ADD CONSTRAINT goal_steps_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goals goals_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: goals goals_difficulty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_difficulty_id_fkey FOREIGN KEY (difficulty_id) REFERENCES public.difficulty_levels(id) ON DELETE RESTRICT;


--
-- Name: goals goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_files media_files_record_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_record_id_user_id_fkey FOREIGN KEY (record_id, user_id) REFERENCES public.mission_records(id, user_id) ON DELETE CASCADE;


--
-- Name: mission_definitions mission_definitions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_definitions
    ADD CONSTRAINT mission_definitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: mission_definitions mission_definitions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_definitions
    ADD CONSTRAINT mission_definitions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mission_definitions mission_definitions_difficulty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_definitions
    ADD CONSTRAINT mission_definitions_difficulty_id_fkey FOREIGN KEY (difficulty_id) REFERENCES public.difficulty_levels(id) ON DELETE RESTRICT;


--
-- Name: mission_point_awards mission_point_awards_first_approved_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_point_awards
    ADD CONSTRAINT mission_point_awards_first_approved_result_id_fkey FOREIGN KEY (first_approved_result_id) REFERENCES public.verification_results(id) ON DELETE CASCADE;


--
-- Name: mission_point_awards mission_point_awards_mission_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_point_awards
    ADD CONSTRAINT mission_point_awards_mission_id_user_id_fkey FOREIGN KEY (mission_id, user_id) REFERENCES public.missions(id, user_id) ON DELETE CASCADE;


--
-- Name: mission_publication_reviews mission_publication_reviews_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_publication_reviews
    ADD CONSTRAINT mission_publication_reviews_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.mission_definitions(id) ON DELETE CASCADE;


--
-- Name: mission_publication_reviews mission_publication_reviews_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_publication_reviews
    ADD CONSTRAINT mission_publication_reviews_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mission_publication_reviews mission_publication_reviews_reviewed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_publication_reviews
    ADD CONSTRAINT mission_publication_reviews_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: mission_records mission_records_mission_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_mission_id_user_id_fkey FOREIGN KEY (mission_id, user_id) REFERENCES public.missions(id, user_id) ON DELETE CASCADE;


--
-- Name: mission_records mission_records_reward_pet_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_records
    ADD CONSTRAINT mission_records_reward_pet_owner_fk FOREIGN KEY (reward_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE RESTRICT;


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: mission_reward_rate_versions mission_reward_rate_versions_difficulty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reward_rate_versions
    ADD CONSTRAINT mission_reward_rate_versions_difficulty_id_fkey FOREIGN KEY (difficulty_id) REFERENCES public.difficulty_levels(id) ON DELETE RESTRICT;


--
-- Name: missions missions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: missions missions_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.mission_definitions(id) ON DELETE RESTRICT;


--
-- Name: missions missions_difficulty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_difficulty_id_fkey FOREIGN KEY (difficulty_id) REFERENCES public.difficulty_levels(id) ON DELETE RESTRICT;


--
-- Name: missions missions_goal_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_goal_id_user_id_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE CASCADE;


--
-- Name: missions missions_goal_step_id_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_goal_step_id_goal_id_fkey FOREIGN KEY (goal_step_id, goal_id) REFERENCES public.goal_steps(id, goal_id) ON DELETE CASCADE;


--
-- Name: missions missions_reward_rate_matches_category_difficulty; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_reward_rate_matches_category_difficulty FOREIGN KEY (reward_rate_version_id, category_id, difficulty_id) REFERENCES public.mission_reward_rate_versions(id, category_id, difficulty_id) ON DELETE RESTRICT;


--
-- Name: missions missions_source_proposal_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_source_proposal_id_user_id_fkey FOREIGN KEY (source_proposal_id, user_id) REFERENCES public.ai_plan_proposals(id, user_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: missions missions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notice_recipients notice_recipients_notice_id_audience_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_recipients
    ADD CONSTRAINT notice_recipients_notice_id_audience_type_fkey FOREIGN KEY (notice_id, audience_type) REFERENCES public.notices(id, audience_type) ON DELETE CASCADE;


--
-- Name: notice_recipients notice_recipients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_recipients
    ADD CONSTRAINT notice_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notices notices_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: notices notices_policy_document_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_policy_document_version_id_fkey FOREIGN KEY (policy_document_version_id) REFERENCES public.policy_document_versions(id) ON DELETE RESTRICT;


--
-- Name: pending_pet_experience pending_pet_experience_assigned_pet_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_pet_experience
    ADD CONSTRAINT pending_pet_experience_assigned_pet_id_user_id_fkey FOREIGN KEY (assigned_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE RESTRICT;


--
-- Name: pending_pet_experience pending_pet_experience_experience_award_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_pet_experience
    ADD CONSTRAINT pending_pet_experience_experience_award_id_user_id_fkey FOREIGN KEY (experience_award_id, user_id) REFERENCES public.experience_awards(id, user_id) ON DELETE CASCADE;


--
-- Name: pet_evolution_events pet_evolution_events_user_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_evolution_events
    ADD CONSTRAINT pet_evolution_events_user_pet_id_fkey FOREIGN KEY (user_pet_id) REFERENCES public.user_pets(id) ON DELETE CASCADE;


--
-- Name: pet_level_policy_versions pet_level_policy_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_policy_versions
    ADD CONSTRAINT pet_level_policy_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: pet_level_thresholds pet_level_thresholds_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_level_thresholds
    ADD CONSTRAINT pet_level_thresholds_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.pet_level_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: pet_species pet_species_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species
    ADD CONSTRAINT pet_species_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: pet_species_versions pet_species_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: pet_species_versions pet_species_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: pet_species_versions pet_species_versions_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_species_id_fkey FOREIGN KEY (species_id) REFERENCES public.pet_species(id) ON DELETE RESTRICT;


--
-- Name: pet_species_versions pet_species_versions_unlock_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_unlock_achievement_id_fkey FOREIGN KEY (unlock_achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE RESTRICT;


--
-- Name: pet_species_versions pet_species_versions_unlock_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_species_versions
    ADD CONSTRAINT pet_species_versions_unlock_category_id_fkey FOREIGN KEY (unlock_category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: pet_stage_dialogues pet_stage_dialogues_species_version_id_stage_no_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_dialogues
    ADD CONSTRAINT pet_stage_dialogues_species_version_id_stage_no_fkey FOREIGN KEY (species_version_id, stage_no) REFERENCES public.pet_stage_versions(species_version_id, stage_no) ON DELETE RESTRICT;


--
-- Name: pet_stage_images pet_stage_images_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_images
    ADD CONSTRAINT pet_stage_images_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: pet_stage_images pet_stage_images_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_images
    ADD CONSTRAINT pet_stage_images_species_id_fkey FOREIGN KEY (species_id) REFERENCES public.pet_species(id) ON DELETE RESTRICT;


--
-- Name: pet_stage_versions pet_stage_versions_image_id_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_versions
    ADD CONSTRAINT pet_stage_versions_image_id_species_id_fkey FOREIGN KEY (image_id, species_id) REFERENCES public.pet_stage_images(id, species_id) ON DELETE RESTRICT;


--
-- Name: pet_stage_versions pet_stage_versions_species_version_id_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_stage_versions
    ADD CONSTRAINT pet_stage_versions_species_version_id_species_id_fkey FOREIGN KEY (species_version_id, species_id) REFERENCES public.pet_species_versions(id, species_id) ON DELETE RESTRICT;


--
-- Name: phone_credentials phone_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_credentials
    ADD CONSTRAINT phone_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plan_adjustment_proposals plan_adjustment_proposals_goal_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_adjustment_proposals
    ADD CONSTRAINT plan_adjustment_proposals_goal_id_user_id_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE CASCADE;


--
-- Name: plan_adjustment_proposals plan_adjustment_proposals_run_id_run_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_adjustment_proposals
    ADD CONSTRAINT plan_adjustment_proposals_run_id_run_type_fkey FOREIGN KEY (run_id, run_type) REFERENCES public.ai_analysis_runs(id, run_type) ON DELETE CASCADE;


--
-- Name: plan_adjustment_proposals plan_adjustment_proposals_run_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_adjustment_proposals
    ADD CONSTRAINT plan_adjustment_proposals_run_id_user_id_fkey FOREIGN KEY (run_id, user_id) REFERENCES public.ai_analysis_runs(id, user_id) ON DELETE CASCADE;


--
-- Name: point_monthly_cap_policies point_monthly_cap_policies_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_monthly_cap_policies
    ADD CONSTRAINT point_monthly_cap_policies_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: point_monthly_usage point_monthly_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_monthly_usage
    ADD CONSTRAINT point_monthly_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_achievement_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_achievement_owner_fk FOREIGN KEY (user_achievement_id, user_id) REFERENCES public.user_achievements(id, user_id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_challenge_grant_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_challenge_grant_owner_fk FOREIGN KEY (challenge_reward_grant_id, user_id) REFERENCES public.challenge_reward_grants(id, user_id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_claims_mission_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_claims_mission_id_user_id_fkey FOREIGN KEY (mission_id, user_id) REFERENCES public.mission_point_awards(mission_id, user_id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_original_award_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_original_award_owner_fk FOREIGN KEY (original_award_transaction_id, user_id) REFERENCES public.point_transactions(id, user_id) ON DELETE CASCADE;


--
-- Name: point_recovery_claims point_recovery_streak_award_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_recovery_claims
    ADD CONSTRAINT point_recovery_streak_award_owner_fk FOREIGN KEY (streak_milestone_award_id, user_id) REFERENCES public.streak_milestone_awards(id, user_id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: point_transactions point_transactions_original_transaction_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_original_transaction_id_user_id_fkey FOREIGN KEY (original_transaction_id, user_id) REFERENCES public.point_transactions(id, user_id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_recovery_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_recovery_claim_id_fkey FOREIGN KEY (recovery_claim_id) REFERENCES public.point_recovery_claims(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: point_wallets point_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_wallets
    ADD CONSTRAINT point_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_representative_achievement_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_representative_achievement_owner_fk FOREIGN KEY (representative_achievement_id, user_id) REFERENCES public.user_achievements(id, user_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: profiles profiles_representative_pet_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_representative_pet_owner_fk FOREIGN KEY (representative_pet_id, user_id) REFERENCES public.user_pets(id, user_id) ON DELETE SET NULL (representative_pet_id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_devices push_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recommendation_messages recommendation_messages_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_messages
    ADD CONSTRAINT recommendation_messages_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: recommendation_messages recommendation_messages_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_messages
    ADD CONSTRAINT recommendation_messages_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: recommendation_messages recommendation_messages_updated_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_messages
    ADD CONSTRAINT recommendation_messages_updated_by_admin_id_fkey FOREIGN KEY (updated_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: shop_item_price_versions shop_item_price_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_item_price_versions
    ADD CONSTRAINT shop_item_price_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: shop_item_price_versions shop_item_price_versions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_item_price_versions
    ADD CONSTRAINT shop_item_price_versions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id) ON DELETE RESTRICT;


--
-- Name: shop_orders shop_orders_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id) ON DELETE RESTRICT;


--
-- Name: shop_orders shop_orders_price_version_id_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_price_version_id_item_id_fkey FOREIGN KEY (price_version_id, item_id) REFERENCES public.shop_item_price_versions(id, item_id) ON DELETE RESTRICT;


--
-- Name: shop_orders shop_orders_refund_transaction_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_refund_transaction_id_user_id_fkey FOREIGN KEY (refund_transaction_id, user_id) REFERENCES public.point_transactions(id, user_id) ON DELETE CASCADE;


--
-- Name: shop_orders shop_orders_spend_transaction_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_spend_transaction_id_user_id_fkey FOREIGN KEY (spend_transaction_id, user_id) REFERENCES public.point_transactions(id, user_id) ON DELETE CASCADE;


--
-- Name: shop_orders shop_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: streak_days streak_days_qualifying_mission_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_days
    ADD CONSTRAINT streak_days_qualifying_mission_id_user_id_fkey FOREIGN KEY (qualifying_mission_id, user_id) REFERENCES public.missions(id, user_id) ON DELETE CASCADE;


--
-- Name: streak_days streak_days_qualifying_record_id_qualifying_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_days
    ADD CONSTRAINT streak_days_qualifying_record_id_qualifying_mission_id_fkey FOREIGN KEY (qualifying_record_id, qualifying_mission_id) REFERENCES public.mission_records(id, mission_id) ON DELETE CASCADE;


--
-- Name: streak_days streak_days_qualifying_result_id_qualifying_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_days
    ADD CONSTRAINT streak_days_qualifying_result_id_qualifying_record_id_fkey FOREIGN KEY (qualifying_result_id, qualifying_record_id) REFERENCES public.verification_results(id, record_id) ON DELETE CASCADE;


--
-- Name: streak_days streak_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_days
    ADD CONSTRAINT streak_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: streak_milestone_awards streak_milestone_awards_policy_version_id_target_success_d_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_policy_version_id_target_success_d_fkey FOREIGN KEY (policy_version_id, target_success_days) REFERENCES public.streak_milestone_policy_versions(id, target_success_days) ON DELETE RESTRICT;


--
-- Name: streak_milestone_awards streak_milestone_awards_user_id_first_achieved_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_user_id_first_achieved_date_fkey FOREIGN KEY (user_id, first_achieved_date) REFERENCES public.streak_days(user_id, streak_date) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: streak_milestone_awards streak_milestone_awards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_awards
    ADD CONSTRAINT streak_milestone_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: streak_milestone_policy_versions streak_milestone_policy_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_milestone_policy_versions
    ADD CONSTRAINT streak_milestone_policy_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: streak_states streak_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_states
    ADD CONSTRAINT streak_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_ticket_events support_ticket_events_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: support_ticket_events support_ticket_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_resolutions support_ticket_resolutions_account_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_resolutions
    ADD CONSTRAINT support_ticket_resolutions_account_action_id_fkey FOREIGN KEY (account_action_id) REFERENCES public.account_actions(id) ON DELETE SET NULL;


--
-- Name: support_ticket_resolutions support_ticket_resolutions_resolved_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_resolutions
    ADD CONSTRAINT support_ticket_resolutions_resolved_by_admin_id_fkey FOREIGN KEY (resolved_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: support_ticket_resolutions support_ticket_resolutions_ticket_id_ticket_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_resolutions
    ADD CONSTRAINT support_ticket_resolutions_ticket_id_ticket_type_fkey FOREIGN KEY (ticket_id, ticket_type) REFERENCES public.support_tickets(id, ticket_type) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: support_tickets support_tickets_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_target_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_target_challenge_id_fkey FOREIGN KEY (target_challenge_id) REFERENCES public.challenges(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_target_mission_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_target_mission_definition_id_fkey FOREIGN KEY (target_mission_definition_id) REFERENCES public.mission_definitions(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_achievement_events user_achievement_events_user_achievement_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_events
    ADD CONSTRAINT user_achievement_events_user_achievement_id_user_id_fkey FOREIGN KEY (user_achievement_id, user_id) REFERENCES public.user_achievements(id, user_id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE RESTRICT;


--
-- Name: user_achievements user_achievements_achievement_version_id_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_version_id_achievement_id_fkey FOREIGN KEY (achievement_version_id, achievement_id) REFERENCES public.achievement_versions(id, achievement_id) ON DELETE RESTRICT;


--
-- Name: user_achievements user_achievements_badge_image_id_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_badge_image_id_achievement_id_fkey FOREIGN KEY (badge_image_id, achievement_id) REFERENCES public.achievement_badge_images(id, achievement_id) ON DELETE RESTRICT;


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_experience user_experience_level_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_experience
    ADD CONSTRAINT user_experience_level_policy_version_id_fkey FOREIGN KEY (level_policy_version_id) REFERENCES public.user_level_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: user_experience user_experience_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_experience
    ADD CONSTRAINT user_experience_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_idempotency_keys user_idempotency_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_idempotency_keys
    ADD CONSTRAINT user_idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_inventory_events user_inventory_events_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory_events
    ADD CONSTRAINT user_inventory_events_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id) ON DELETE RESTRICT;


--
-- Name: user_inventory_events user_inventory_events_order_id_user_id_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory_events
    ADD CONSTRAINT user_inventory_events_order_id_user_id_item_id_fkey FOREIGN KEY (order_id, user_id, item_id) REFERENCES public.shop_orders(id, user_id, item_id) ON DELETE CASCADE;


--
-- Name: user_inventory_events user_inventory_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory_events
    ADD CONSTRAINT user_inventory_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_inventory user_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id) ON DELETE RESTRICT;


--
-- Name: user_inventory user_inventory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_level_policy_versions user_level_policy_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_policy_versions
    ADD CONSTRAINT user_level_policy_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: user_level_thresholds user_level_thresholds_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_level_thresholds
    ADD CONSTRAINT user_level_thresholds_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.user_level_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: user_notifications user_notifications_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.notices(id) ON DELETE RESTRICT;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pets user_pets_level_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_level_policy_version_id_fkey FOREIGN KEY (level_policy_version_id) REFERENCES public.pet_level_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: user_pets user_pets_species_version_id_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_species_version_id_species_id_fkey FOREIGN KEY (species_version_id, species_id) REFERENCES public.pet_species_versions(id, species_id) ON DELETE RESTRICT;


--
-- Name: user_pets user_pets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_appeals verification_appeals_original_result_id_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_original_result_id_record_id_fkey FOREIGN KEY (original_result_id, record_id) REFERENCES public.verification_results(id, record_id) ON DELETE CASCADE;


--
-- Name: verification_appeals verification_appeals_record_id_filed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_record_id_filed_by_user_id_fkey FOREIGN KEY (record_id, filed_by_user_id) REFERENCES public.mission_records(id, user_id) ON DELETE CASCADE;


--
-- Name: verification_appeals verification_appeals_resolution_result_id_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_resolution_result_id_record_id_fkey FOREIGN KEY (resolution_result_id, record_id) REFERENCES public.verification_results(id, record_id) ON DELETE CASCADE;


--
-- Name: verification_appeals verification_appeals_reviewed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_appeals
    ADD CONSTRAINT verification_appeals_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: verification_criteria_versions verification_criteria_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_criteria_versions
    ADD CONSTRAINT verification_criteria_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.goal_categories(id) ON DELETE RESTRICT;


--
-- Name: verification_criteria_versions verification_criteria_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_criteria_versions
    ADD CONSTRAINT verification_criteria_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: verification_results verification_results_criteria_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_criteria_version_id_fkey FOREIGN KEY (criteria_version_id) REFERENCES public.verification_criteria_versions(id) ON DELETE RESTRICT;


--
-- Name: verification_results verification_results_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.mission_records(id) ON DELETE CASCADE;


--
-- Name: verification_results verification_results_reviewed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin_accounts(id) ON DELETE RESTRICT;


--
-- Name: weather_observations weather_observations_nx_ny_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations
    ADD CONSTRAINT weather_observations_nx_ny_fkey FOREIGN KEY (nx, ny) REFERENCES public.weather_grid_cells(nx, ny) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict FPjhsMwLotmUmHaCRydojCexSFWzwzYiKcXksBB214QG6Uepo4hAPffFviiX9Tn

