import RecordFab from '@/components/meetings/RecordFab'

export default function MeetingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RecordFab />
    </>
  )
}
