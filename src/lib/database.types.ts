export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          text: string
          sender: string
          created_at: string
        }
        Insert: {
          id?: string
          text: string
          sender: string
          created_at?: string
        }
        Update: {
          id?: string
          text?: string
          sender?: string
          created_at?: string
        }
      }
    }
  }
}