import 'package:flutter/material.dart';

class PostReactionBar extends StatelessWidget {
  final int likes;
  final int dislikes;
  final bool? myReaction; // true like, false dislike, null none
  final VoidCallback onLike;
  final VoidCallback onDislike;

  const PostReactionBar({
    super.key,
    required this.likes,
    required this.dislikes,
    required this.myReaction,
    required this.onLike,
    required this.onDislike,
  });

  @override
  Widget build(BuildContext context) {
    final isLike = myReaction == true;
    final isDislike = myReaction == false;

    return Row(
      children: [
        _ReactionButton(
          active: isLike,
          icon: Icons.thumb_up_alt_rounded,
          label: likes.toString(),
          onTap: onLike,
        ),
        const SizedBox(width: 10),
        _ReactionButton(
          active: isDislike,
          icon: Icons.thumb_down_alt_rounded,
          label: dislikes.toString(),
          onTap: onDislike,
        ),
      ],
    );
  }
}

class _ReactionButton extends StatelessWidget {
  final bool active;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ReactionButton({
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.black : const Color(0xFFF2F3F5),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: active ? Colors.white : Colors.black87),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: active ? Colors.white : Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
