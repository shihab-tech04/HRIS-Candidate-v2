import type { CandidateRoute } from './candidateRoutes';

export type CandidateNotificationRouteInput = {
  notification_type?: string | null;
  related_application_id?: string | null;
  related_job_id?: string | null;
};

export function candidateNotificationRoute(notification: CandidateNotificationRouteInput): CandidateRoute | null {
  if (notification.notification_type === 'application_update' && notification.related_application_id) {
    return { tab: 'applications', applicationId: notification.related_application_id };
  }
  if (notification.notification_type === 'job_alert_match' && notification.related_job_id) {
    return { tab: 'saved-jobs' };
  }
  return null;
}
