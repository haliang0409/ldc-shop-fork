import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Run schema migrations directly
        await db.execute(sql`
            -- Create tables if not exist
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                category TEXT,
                image TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                purchase_limit INTEGER,
                single_card_only BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                card_key TEXT NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                reserved_order_id TEXT,
                reserved_at TIMESTAMP,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                product_name TEXT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                quantity INTEGER DEFAULT 1,
                note TEXT,
                card_keys TEXT,
                original_amount DECIMAL(10, 2),
                discount_code TEXT,
                discount_amount DECIMAL(10, 2),
                admin_adjusted_from DECIMAL(10, 2),
                admin_adjusted_by TEXT,
                admin_adjusted_reason TEXT,
                admin_adjusted_at TIMESTAMP,
                email TEXT,
                status TEXT DEFAULT 'pending',
                trade_no TEXT,
                card_key TEXT,
                paid_at TIMESTAMP,
                delivered_at TIMESTAMP,
                user_id TEXT,
                username TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS discount_codes (
                code TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                value DECIMAL(10, 2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                max_uses INTEGER,
                used_count INTEGER DEFAULT 0 NOT NULL,
                min_amount DECIMAL(10, 2),
                starts_at TIMESTAMP,
                ends_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS login_users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                points INTEGER DEFAULT 0 NOT NULL,
                is_banned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Add missing columns for existing databases
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_limit INTEGER;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS single_card_only BOOLEAN DEFAULT FALSE;
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_keys TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_from DECIMAL(10, 2);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_by TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_reason TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_at TIMESTAMP;
            ALTER TABLE login_users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL;
            ALTER TABLE login_users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
        `);

        return NextResponse.json({ success: true, message: "Database initialized successfully" });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
