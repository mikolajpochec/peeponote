import { Peepo } from '../../ui/Peepo'

export function Loading({ error }: { error?: string | null }) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-[12px] text-frog-200/70">
      {error ? (
        <>
          <Peepo name="PepeHands" size={28} /> <span className="truncate">{error}</span>
        </>
      ) : (
        <Peepo name="peepoThink" size={28} className="peepo-bounce" />
      )}
    </div>
  )
}
