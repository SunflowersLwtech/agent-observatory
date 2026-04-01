import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 py-3 border-b border-border/50">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48 mt-1" />
      </div>
      <div className="flex-1 px-6 py-6 space-y-4">
        <Skeleton className="h-16 w-3/4 ml-auto" />
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-12 w-1/2 ml-auto" />
      </div>
      <div className="border-t border-border/50 px-6 py-4">
        <Skeleton className="h-10 w-full max-w-3xl mx-auto" />
      </div>
    </div>
  );
}
