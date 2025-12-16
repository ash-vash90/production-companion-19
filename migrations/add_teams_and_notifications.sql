-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_nl text,
  description text,
  description_nl text,
  color text DEFAULT '#6366f1',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_teams junction table
CREATE TABLE IF NOT EXISTS user_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  is_lead boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Users can view all teams"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage teams"
  ON teams FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_teams
CREATE POLICY "Users can view all team memberships"
  ON user_teams FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage team memberships"
  ON user_teams FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default teams
INSERT INTO teams (name, name_nl, description, description_nl, color) VALUES
  ('Production', 'Productie', 'Assembly and manufacturing team', 'Assemblage en productie team', '#22c55e'),
  ('Logistics', 'Logistiek', 'Inventory and shipping team', 'Voorraad en verzending team', '#3b82f6'),
  ('Quality', 'Kwaliteit', 'Quality control and certification', 'Kwaliteitscontrole en certificering', '#eab308'),
  ('Engineering', 'Engineering', 'Technical support and R&D', 'Technische ondersteuning en ontwikkeling', '#8b5cf6')
ON CONFLICT (name) DO NOTHING;

-- Update default notification_prefs for profiles table
ALTER TABLE profiles 
ALTER COLUMN notification_prefs 
SET DEFAULT '{
  "channels": {"in_app": true, "push": false, "email": false},
  "types": {
    "mentions": true,
    "assigned_work": true,
    "work_order_status": true,
    "step_completions": false,
    "low_stock": false,
    "quality_alerts": false,
    "team_announcements": true,
    "system_updates": false
  },
  "quiet_hours": {"enabled": false, "start": "22:00", "end": "07:00"},
  "sound_enabled": true
}'::jsonb;
