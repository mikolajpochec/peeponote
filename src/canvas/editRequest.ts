import { createContext, useContext, useEffect } from 'react'

/**
 * Pointer capture during drag makes dblclick land on the card shell, not the content.
 * The shell bumps this counter on double-click; card contents subscribe to start editing.
 */
export const EditRequestContext = createContext(0)

export function useEditRequest(onEdit: () => void) {
  const tick = useContext(EditRequestContext)
  useEffect(() => {
    if (tick > 0) onEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
}
