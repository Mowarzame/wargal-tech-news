import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  static Future<void> logPostOpen({
    required String postId,
    required String title,
  }) async {
    await _analytics.logEvent(
      name: 'post_open',
      parameters: {
        'post_id': postId,
        'title': title,
      },
    );
  }

  static Future<void> logPostLike({required String postId}) async {
    await _analytics.logEvent(
      name: 'post_like',
      parameters: {'post_id': postId},
    );
  }

  static Future<void> logPostDislike({required String postId}) async {
    await _analytics.logEvent(
      name: 'post_dislike',
      parameters: {'post_id': postId},
    );
  }

  static Future<void> logCommentAdd({required String postId}) async {
    await _analytics.logEvent(
      name: 'post_comment_add',
      parameters: {'post_id': postId},
    );
  }

  static Future<void> logCreatePost() async {
    await _analytics.logEvent(name: 'post_create_submit');
  }

  static Future<void> logEditorsOpen() async {
    await _analytics.logEvent(name: 'editors_feed_open');
  }

  static Future<void> logBreakingOpen() async {
    await _analytics.logEvent(name: 'breaking_open');
  }

  static Future<void> logNewsOpen() async {
    await _analytics.logEvent(name: 'news_open');
  }
}