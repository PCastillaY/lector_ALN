import { ReaderWorkspace } from "@/components/reader/reader-workspace"

interface ReaderPageProps {
  params: Promise<{ id: string }>
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params
  return <ReaderWorkspace documentId={id} />
}
