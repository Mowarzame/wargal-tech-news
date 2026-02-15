import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:tech_news_app/models/news_item.dart';
import 'package:tech_news_app/models/news_source.dart';
import 'package:tech_news_app/models/post_reaction_user.dart';
import '../config/app_config.dart';
import '../models/post.dart';
import 'auth_service.dart';
import 'package:path/path.dart' as p; // ✅ ADD THIS
import '../models/comment.dart';
import '../models/user_dto.dart';



class ApiService {
  final AuthService _auth = AuthService();

  Future<Map<String, String>> _headers() async {
    final token = await _auth.getToken();
    final headers = {"Content-Type": "application/json"};
    if (token != null) headers["Authorization"] = "Bearer $token";
    return headers;
  }
  Future<Map<String, String>> _authHeaderOnly() async {
    final token = await _auth.getToken();
    final headers = <String, String>{};
    if (token != null) headers["Authorization"] = "Bearer $token";
    return headers;
  }
  Future<List<Post>> getPosts() async {
    final res = await http.get(
      Uri.parse("${AppConfig.apiBaseUrl}/posts"),
      headers: await _headers(),
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body)['data'] as List;
      return data.map((e) => Post.fromJson(e)).toList();
    }
    throw Exception("Failed to load posts (${res.statusCode})");
  }



Future<Post> getPostById(String id) async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/$id"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final data = jsonDecode(res.body)['data'];
    return Post.fromJson(data);
  }
  throw Exception("Failed to load post (${res.statusCode})");
}



  Future<Post> createPost(Map<String, dynamic> postData) async {
    final res = await http.post(
      Uri.parse("${AppConfig.apiBaseUrl}/posts"),
      headers: await _headers(),
      body: jsonEncode(postData),
    );

    if (res.statusCode == 201 || res.statusCode == 200) {
      final data = jsonDecode(res.body)['data'];
      return Post.fromJson(data);
    }
    throw Exception("Failed to create post (${res.statusCode})");
  }

Future<List<Post>> getAllPostsAdmin() async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/all"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final data = jsonDecode(res.body)['data'] as List;
    return data.map((e) => Post.fromJson(e)).toList();
  }
  throw Exception("Failed to load admin posts (${res.statusCode})");
}

Future<List<Post>> getPendingPosts() async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/pending"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final data = jsonDecode(res.body)['data'] as List;
    return data.map((e) => Post.fromJson(e)).toList();
  }
  throw Exception("Failed to load pending posts (${res.statusCode})");
}

Future<void> unverifyPost(String postId) async {
  final res = await http.put(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/unverify/$postId"),
    headers: await _headers(),
  );
  if (res.statusCode != 200) {
    throw Exception("Failed to unverify post (${res.statusCode})");
  }
}

Future<void> deletePost(String postId) async {
  final res = await http.delete(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId"),
    headers: await _headers(),
  );
  if (res.statusCode != 200) {
    throw Exception("Failed to delete post (${res.statusCode})");
  }
}

  // ✅ Multipart create (with optional image)
  Future<Post> createPostWithImage({
    required String title,
    required String content,
    String? videoUrl,
    File? imageFile,
  }) async {
    // ⚠️ IMPORTANT: this URL must match your backend route for form upload
    final uri = Uri.parse("${AppConfig.apiBaseUrl}/posts/with-image");

    final request = http.MultipartRequest("POST", uri);

    // ✅ Add auth header only. DO NOT set Content-Type manually.
    request.headers.addAll(await _authHeaderOnly());

    // ✅ Form fields (must match backend DTO property names)
    request.fields["Title"] = title;
    request.fields["Content"] = content;
    if (videoUrl != null && videoUrl.trim().isNotEmpty) {
      request.fields["VideoUrl"] = videoUrl.trim();
    }

    // ✅ File field name must match backend: usually "Image"
    if (imageFile != null) {
      request.files.add(
        await http.MultipartFile.fromPath(
          "Image",
          imageFile.path,
          filename: p.basename(imageFile.path),
        ),
      );
    }

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);

    if (res.statusCode == 200 || res.statusCode == 201) {
      final json = jsonDecode(res.body);
      return Post.fromJson(json["data"]);
    }

    throw Exception("Failed to create post (${res.statusCode}): ${res.body}");
  }


  // For Admin verify flow (when you expose endpoint)
  Future<void> verifyPost(String postId) async {
    final res = await http.put(
      Uri.parse("${AppConfig.apiBaseUrl}/posts/verify/$postId"),
      headers: await _headers(),
    );
    if (res.statusCode != 200) {
      throw Exception("Failed to verify post (${res.statusCode})");
    }
  }


  // Comments
    // Comments

  Future<List<Comment>> getCommentsByPostId(String postId) async {
    final res = await http.get(
      Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId/comments"),
      headers: await _headers(),
    );

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      final data = (body['data'] as List?) ?? [];
      return data.map((e) => Comment.fromJson(e)).toList();
    }

    // Try to surface backend message if available
    try {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? "Failed to load comments (${res.statusCode})");
    } catch (_) {
      throw Exception("Failed to load comments (${res.statusCode})");
    }
  }

  Future<Comment> addComment({
    required String postId,
    required String content,
  }) async {
    final trimmed = content.trim();
    if (trimmed.isEmpty) {
      throw Exception("Comment cannot be empty");
    }

    final res = await http.post(
      Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId/comments"),
      headers: await _headers(),
      body: jsonEncode({"content": trimmed}),
    );

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body);
      final data = body['data'];
      return Comment.fromJson(data);
    }

    try {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? "Failed to add comment (${res.statusCode})");
    } catch (_) {
      throw Exception("Failed to add comment (${res.statusCode}): ${res.body}");
    }
  }

  Future<void> deleteComment(String commentId) async {
    final res = await http.delete(
      Uri.parse("${AppConfig.apiBaseUrl}/comments/$commentId"),
      headers: await _headers(),
    );

    if (res.statusCode == 200) return;

    try {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? "Failed to delete comment (${res.statusCode})");
    } catch (_) {
      throw Exception("Failed to delete comment (${res.statusCode}): ${res.body}");
    }
  }
  Future<List<Comment>> getCommentsByPostByIdSafe(String postId) async {
  return getCommentsByPostId(postId);
}

// Reactions
Future<Map<String, dynamic>> getPostReactionSummary(String postId) async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId/reactions"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    return jsonDecode(res.body)['data'] as Map<String, dynamic>;
  }

  final body = jsonDecode(res.body);
  throw Exception(body['message'] ?? "Failed to load reactions (${res.statusCode})");
}

Future<Map<String, dynamic>> reactToPost({
  required String postId,
  required bool? isLike, // true like, false dislike, null undo
}) async {
  final res = await http.put(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId/reactions"),
    headers: await _headers(),
    body: jsonEncode({"isLike": isLike}),
  );

  if (res.statusCode == 200) {
    return jsonDecode(res.body)['data'] as Map<String, dynamic>;
  }

  final body = jsonDecode(res.body);
  throw Exception(body['message'] ?? "Failed to react (${res.statusCode})");
}

  Future<List<PostReactionUser>> getPostReactionsUsers(String postId) async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/$postId/reactions/users"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    final data = (body['data'] as List?) ?? [];
    return data.map((e) => PostReactionUser.fromJson(e)).toList();
  }

  final body = jsonDecode(res.body);
  throw Exception(body['message'] ?? "Failed to load reactions users (${res.statusCode})");
}
Future<List<NewsItem>> getNews({String? sourceId}) async {
  final candidates = [
    "${AppConfig.apiBaseUrl}/news-sources",
    "${AppConfig.apiBaseUrl}/news-sources/items",
    "${AppConfig.apiBaseUrl}/news-sources/articles",
    "${AppConfig.apiBaseUrl}/news-sources/feed",
  ];

  for (final path in candidates) {
    final uri = Uri.parse(path).replace(queryParameters: {
      if (sourceId != null && sourceId.isNotEmpty) "sourceId": sourceId,
    });

    final res = await http.get(uri, headers: await _headers());
    print("PROBE NEWS => $uri => ${res.statusCode}");

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      final data = (body['data'] as List?) ?? [];
      return data.map((e) => NewsItem.fromJson(e)).toList();
    }
  }

  throw Exception("Failed to load news (404) - no matching endpoint found");
}


Future<List<NewsSource>> getNewsSources({String? category}) async {
  final uri = Uri.parse("${AppConfig.apiBaseUrl}/news-sources").replace(
    queryParameters: {
      if (category != null && category.trim().isNotEmpty) "category": category.trim(),
    },
  );

  final res = await http.get(uri, headers: await _headers());

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    final data = (body['data'] as List?) ?? [];
    return data.map((e) => NewsSource.fromJson(e)).toList();
  }

  throw Exception("Failed to load sources (${res.statusCode}): ${res.body}");
}

Future<List<NewsItem>> getNewsItems({String? sourceId}) async {
  final uri = Uri.parse("${AppConfig.apiBaseUrl}/news-items").replace(
    queryParameters: {
      if (sourceId != null && sourceId.isNotEmpty) "sourceId": sourceId,
    },
  );

  final res = await http.get(uri, headers: await _headers());

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    final data = (body['data'] as List?) ?? [];
    return data.map((e) => NewsItem.fromJson(e)).toList();
  }

  final body = jsonDecode(res.body);
  throw Exception(body['message'] ?? "Failed to load news items (${res.statusCode})");
}

Future<UserDto> getMe() async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/users/me"),
    headers: await _headers(),
  );

  final body = jsonDecode(res.body);
  if (res.statusCode == 200 && body["data"] != null) {
    return UserDto.fromJson(body["data"]);
  }

  throw Exception(body["message"] ?? "Failed to load me (${res.statusCode})");
}

Future<UserDto> getUserById(String userId) async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/users/$userId"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    return UserDto.fromJson(body['data']);
  }

  try {
    final body = jsonDecode(res.body);
    throw Exception(body['message'] ?? "Failed to load user");
  } catch (_) {
    throw Exception("Failed to load user (${res.statusCode})");
  }
}

Future<List<Post>> getMyPosts() async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/posts/mine"),
    headers: await _headers(),
  );

  if (res.statusCode != 200) {
    throw Exception("Failed to load my posts: ${res.body}");
  }

  final body = jsonDecode(res.body);
  final data = (body["data"] as List).cast<Map<String, dynamic>>();
  return data.map((e) => Post.fromJson(e)).toList();
}

// Feed Items (aggregated news)
// Feed Items (aggregated news)
Future<List<NewsItem>> getFeedItems({
  int page = 1,
  int pageSize = 20,
  String? kind,        // "Article" or "Video" (optional)
  String? sourceId,
  String? q,
  String? category,    // ✅ NEW
}) async {
  final uri = Uri.parse("${AppConfig.apiBaseUrl}/feed-items").replace(
    queryParameters: {
      "page": page.toString(),
      "pageSize": pageSize.toString(),
      if (kind != null && kind.isNotEmpty) "kind": kind,
      if (sourceId != null && sourceId.isNotEmpty) "sourceId": sourceId,
      if (q != null && q.trim().isNotEmpty) "q": q.trim(),
      if (category != null && category.trim().isNotEmpty) "category": category.trim(), // ✅ NEW
    },
  );

  final res = await http.get(uri, headers: await _headers());

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    final data = (body['data'] as List?) ?? [];
    return data.map((e) => NewsItem.fromJson(e)).toList();
  }

  throw Exception("Failed to load feed-items (${res.statusCode}): ${res.body}");
}

// Chips Sources for Explore UI
Future<List<NewsSource>> getFeedSourcesForUi() async {
  final res = await http.get(
    Uri.parse("${AppConfig.apiBaseUrl}/feed-items/sources"),
    headers: await _headers(),
  );

  if (res.statusCode == 200) {
    final body = jsonDecode(res.body);
    final data = (body['data'] as List?) ?? [];
    return data.map((e) => NewsSource.fromJson(e)).toList();
  }

  throw Exception("Failed to load feed sources (${res.statusCode}): ${res.body}");
}


}
