const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const [menuRes, bomRes] = await Promise.all([
    supabase.from('menu_items').select('*').limit(15),
    supabase.from('bom_packaging').select('*').limit(30),
  ]);

  console.log('Menu items count in sample:', menuRes.data?.length);
  console.log('Sample menu items:', menuRes.data?.slice(0, 6).map(m => ({
    code: m.meal_code,
    name: m.meal_name_ar,
    cat: m.category_ar,
  })));

  console.log('Sample BOM items:', bomRes.data?.slice(0, 8));
}

main().catch(console.error);
