import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../services/api_service.dart';

class CreatePostScreen extends StatefulWidget {
  final VoidCallback? onPostCreated;

  const CreatePostScreen({super.key, this.onPostCreated});

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _videoUrlController = TextEditingController();

  final _titleFocus = FocusNode();
  final _contentFocus = FocusNode();
  final _videoFocus = FocusNode();

  File? _selectedImage;
  bool _isLoading = false;

  final ImagePicker _picker = ImagePicker();

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _videoUrlController.dispose();

    _titleFocus.dispose();
    _contentFocus.dispose();
    _videoFocus.dispose();
    super.dispose();
  }

  Future<void> pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (!mounted) return;
    if (picked != null) {
      setState(() {
        _selectedImage = File(picked.path);
      });
    }
  }

  Future<void> submitPost() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();
    final videoUrl = _videoUrlController.text.trim();

    if (title.isEmpty || content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Title and Content are required")),
      );
      return;
    }

    FocusManager.instance.primaryFocus?.unfocus();

    setState(() => _isLoading = true);

    try {
      // ✅ Use the singleton ApiService from Provider (don’t create new instances)
      final api = context.read<ApiService>();

      await api.createPostWithImage(
        title: title,
        content: content,
        videoUrl: videoUrl,
        imageFile: _selectedImage,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Post submitted for review")),
      );

      // ✅ Clear form
      _titleController.clear();
      _contentController.clear();
      _videoUrlController.clear();
      setState(() {
        _selectedImage = null;
      });

      widget.onPostCreated?.call();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e")),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Create Post")),
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag, // ✅ swipe down to dismiss
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              TextField(
                controller: _titleController,
                focusNode: _titleFocus,
                textInputAction: TextInputAction.next,
                onEditingComplete: () => _contentFocus.requestFocus(),
                decoration: const InputDecoration(labelText: "Title"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _contentController,
                focusNode: _contentFocus,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(labelText: "Content"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _videoUrlController,
                focusNode: _videoFocus,
                textInputAction: TextInputAction.done,
                onEditingComplete: () => FocusManager.instance.primaryFocus?.unfocus(),
                decoration: const InputDecoration(labelText: "YouTube URL (optional)"),
              ),
              const SizedBox(height: 16),

              if (_selectedImage != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_selectedImage!, height: 180),
                ),

              const SizedBox(height: 8),

              OutlinedButton.icon(
                onPressed: _isLoading ? null : pickImage,
                icon: const Icon(Icons.image),
                label: const Text("Pick Image"),
              ),

              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : submitPost,
                  child: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : const Text("Submit Post"),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
