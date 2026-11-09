import { notFound } from "next/navigation"
import { SegmentationTestWorkbench } from "@/components/dev/segmentation-test-workbench"

export default function SegmentationTestPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <SegmentationTestWorkbench />
}
