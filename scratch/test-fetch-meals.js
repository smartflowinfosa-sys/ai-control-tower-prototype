const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function testFetch() {
  const [menuRes, bomRes, invRes] = await Promise.all([
    supabase.from('menu_items').select('*').order('meal_code', { ascending: true }),
    supabase.from('bom_packaging').select('*'),
    supabase.from('inventory_items').select('*'),
  ]);

  const menu = menuRes.data || [];
  const bom = bomRes.data || [];
  const inv = invRes.data || [];

  console.log(`Menu total: ${menu.length}, BOM total: ${bom.length}, Inv total: ${inv.length}`);

  const pancake = menu.find(m => m.meal_name_ar.includes('بان كيك') || m.meal_code === '43015');
  console.log('Pancake found:', pancake);

  const pancakeBom = bom.filter(b => b.meal_code === '43015');
  console.log('Pancake BOM:', pancakeBom);
}

testFetch();
