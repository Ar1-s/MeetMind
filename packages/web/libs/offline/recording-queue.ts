'use client'

import { importRecording } from '@/libs/api/recordings'

const DB_NAME = 'meetmind'
const STORE_NAME = 'recording-queue'
const DB_VERSION = 1

type RecordingQueueItem = {
  id: string
  meetingId: string
  name: string
  type: string
  blob: Blob
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getStore(mode: IDBTransactionMode) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, mode)
  return tx.objectStore(STORE_NAME)
}

export async function enqueueRecording(meetingId: string, file: File) {
  if (typeof window === 'undefined') return
  const store = await getStore('readwrite')
  const item: RecordingQueueItem = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    meetingId,
    name: file.name,
    type: file.type,
    blob: file,
    createdAt: Date.now(),
  }
  store.put(item)
}

async function listQueued(): Promise<RecordingQueueItem[]> {
  const store = await getStore('readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as RecordingQueueItem[])
    request.onerror = () => reject(request.error)
  })
}

async function removeQueued(id: string) {
  const store = await getStore('readwrite')
  store.delete(id)
}

export async function processRecordingQueue() {
  if (typeof window === 'undefined' || !navigator.onLine) return
  const items = await listQueued()
  for (const item of items) {
    try {
      const file = new File([item.blob], item.name, { type: item.type })
      await importRecording(item.meetingId, file)
      await removeQueued(item.id)
    } catch (error) {
      console.error('Failed to upload queued recording:', error)
    }
  }
}
