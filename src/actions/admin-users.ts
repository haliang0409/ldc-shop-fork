'use server'

import { checkAdmin } from "./admin"
import { setUserBanned, updateUserPoints } from "@/lib/db/queries"
import { revalidatePath } from "next/cache"

export async function saveUserPoints(userId: string, points: number) {
    await checkAdmin()
    await updateUserPoints(userId, points)
    revalidatePath('/admin/users')
}

export async function setBanStatus(userId: string, banned: boolean) {
    await checkAdmin()
    await setUserBanned(userId, banned)
    revalidatePath('/admin/users')
}
