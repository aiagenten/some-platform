import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch current user's notification preferences
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'No profile' }, { status: 404 })
    }

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', profile.org_id)
      .single()

    // Return defaults if no preferences set
    return NextResponse.json({
      preferences: prefs || {
        email_on_approval: true,
        email_on_publish: true,
      }
    })
  } catch (err) {
    console.error('Get notification preferences error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'No profile' }, { status: 404 })
    }

    const body = await request.json()
    const { email_on_approval, email_on_publish } = body

    // Upsert preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          org_id: profile.org_id,
          user_id: user.id,
          email_on_approval: email_on_approval ?? true,
          email_on_publish: email_on_publish ?? true,
        },
        { onConflict: 'org_id,user_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Update notification preferences error:', error)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true, preferences: data })
  } catch (err) {
    console.error('Put notification preferences error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
