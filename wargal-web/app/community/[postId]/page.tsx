import PostDetailShell from "@/app/components/community/PostDetailShell";

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return <PostDetailShell postId={postId} />;
}
