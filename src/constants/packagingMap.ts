export interface PackagingProduct {
  id: string;
  name: string;
}

export const PACKAGING_PRODUCTS: PackagingProduct[] = [
  { id: 'none', name: 'بدون' },
  { id: 'all', name: 'الكل' },
  { id: 'main_tray_divided', name: 'Main Tray - Divided | صحن مقسم' },
  { id: 'main_tray_undivided', name: 'Main Tray - Undivided | صحن غير مقسم' },
  { id: 'salad_tray', name: 'Salad Tray | صحن السلطة' },
  { id: 'dessert_tray', name: 'Dessert Tray | صحن الحلو' },
  { id: 'cutlery', name: 'Cutlery | أدوات الطعام' },
  { id: 'sleeves', name: 'Sleeves | أغطية الصحون' },
  { id: 'sauce_cup', name: 'Sauce Cup | علبة الصوص' },
  { id: 'plastic_mini_bag', name: 'Plastic mini Bag | أكياس بلاستيك صغيرة' },
  { id: 'clear_dessert_tray', name: 'Clear Dessert Tray | صحن الحلو شفاف' }
];

export const PACKAGING_MAPPING: Record<string, number[]> = {
  'main_tray_divided': [
    43015, 43160, 42999, 42994, 43004, 42988, 43018, 43003, 43002, 43012,
    43181, 43008, 43032, 43026, 43038, 43060, 43061, 43045, 43031, 43049,
    43051, 43047, 43176
  ],
  'main_tray_undivided': [
    43000, 42998, 42985, 42986, 43016, 42987, 42989, 43014, 43009, 42993,
    43001, 42991, 42992, 43010, 42990, 43017, 42995, 42997, 43005, 43006,
    43011, 43013, 42996, 43068, 43055, 43024, 43065, 43020, 43029, 43062,
    43054, 43040, 43041, 43043, 43056, 43057, 43064, 43037, 43021, 43042,
    43039, 43022, 43175, 43027, 43066, 43067, 43063, 43030, 43059, 43050,
    43053, 43046, 43048, 43052
  ],
  'salad_tray': [
    43070, 43168, 43074, 43075, 43069, 43072, 43073, 43172, 43076, 43071,
    43167, 43079, 43078, 43166, 43077, 43171
  ],
  'cutlery': [43000, 42998, 43015, 43160, 43068, 43055, 43024, 43040],
  'dessert_tray': [],
  'sleeves': [],
  'sauce_cup': [],
  'plastic_mini_bag': [],
  'clear_dessert_tray': []
};

export interface QuantityMealRow {
  id: string | number;
  mealCode: number;
  nameEn: string;
  nameAr: string;
  quantity: number;
  category?: string;
}

/**
 * Standard Bill of Materials (BOM) linked operational meal consumption data
 * covering all mapped meal codes from the packaging inventory ledger.
 */
export const INITIAL_QUANTITY_MEALS: QuantityMealRow[] = [
  // 1. Main Tray - Divided (23 meals)
  { id: 'm-43015', mealCode: 43015, nameEn: 'Grilled Chicken Breast with White Rice', nameAr: 'صدر دجاج مشوي مع أرز أبيض', quantity: 340, category: 'دجاج' },
  { id: 'm-43160', mealCode: 43160, nameEn: 'Beef Tenderloin with Brown Rice', nameAr: 'ستيك لحم تندرلوين مع أرز بني', quantity: 280, category: 'لحوم' },
  { id: 'm-42999', mealCode: 42999, nameEn: 'Grilled Salmon with Quinoa', nameAr: 'سلمون مشوي مع كينوا وخضار', quantity: 215, category: 'مأكولات بحرية' },
  { id: 'm-42994', mealCode: 42994, nameEn: 'Chicken Biryani Light', nameAr: 'برياني دجاج لايت مع صوص زبادي', quantity: 390, category: 'دجاج' },
  { id: 'm-43004', mealCode: 43004, nameEn: 'Teriyaki Chicken with Jasmine Rice', nameAr: 'دجاج ترياكي مع أرز ياسمين', quantity: 260, category: 'دجاج' },
  { id: 'm-42988', mealCode: 42988, nameEn: 'Beef Stroganoff with Mashed Potato', nameAr: 'بيف ستروجانوف مع بطاطس مهروسة', quantity: 195, category: 'لحوم' },
  { id: 'm-43018', mealCode: 43018, nameEn: 'BBQ Chicken with Sweet Potato', nameAr: 'دجاج باربيكيو مع بطاطا حلوة', quantity: 310, category: 'دجاج' },
  { id: 'm-43003', mealCode: 43003, nameEn: 'Herb Grilled Fish with Steamed Veggies', nameAr: 'سمك فيليه مشوي بالأعشاب مع خضار', quantity: 180, category: 'مأكولات بحرية' },
  { id: 'm-43002', mealCode: 43002, nameEn: 'Chicken Fajita Bowl', nameAr: 'فاهيتا دجاج مع خضار مشوية وأرز', quantity: 325, category: 'دجاج' },
  { id: 'm-43012', mealCode: 43012, nameEn: 'Beef Kofta with Vermicelli Rice', nameAr: 'كفتة لحم مشوية مع أرز بالشعيرية', quantity: 270, category: 'لحوم' },
  { id: 'm-43181', mealCode: 43181, nameEn: 'Grilled Shrimp with Saffron Rice', nameAr: 'روبيان مشوي مع أرز بالزعفران', quantity: 160, category: 'مأكولات بحرية' },
  { id: 'm-43008', mealCode: 43008, nameEn: 'Lemon Herb Chicken Breast', nameAr: 'صدر دجاج بخلطة الليمون والأعشاب', quantity: 290, category: 'دجاج' },
  { id: 'm-43032', mealCode: 43032, nameEn: 'Butter Chicken Fit', nameAr: 'بتر تشيكن صحي مع أرز أبيض', quantity: 350, category: 'دجاج' },
  { id: 'm-43026', mealCode: 43026, nameEn: 'Mexican Minced Beef Bowl', nameAr: 'لحم مفروم مكسيكي مع ذرة وفاصوليا حمراء', quantity: 230, category: 'لحوم' },
  { id: 'm-43038', mealCode: 43038, nameEn: 'Honey Mustard Chicken with Rice', nameAr: 'دجاج بصلصة الخردل والعسل مع أرز', quantity: 245, category: 'دجاج' },
  { id: 'm-43060', mealCode: 43060, nameEn: 'Chicken Shawarma Fit Plate', nameAr: 'صحن شاورما دجاج صحي مع ثومية لايت', quantity: 410, category: 'دجاج' },
  { id: 'm-43061', mealCode: 43061, nameEn: 'Grilled Fish Sayadieh', nameAr: 'صيادية سمك صحية مع صوص طحينة', quantity: 175, category: 'مأكولات بحرية' },
  { id: 'm-43045', mealCode: 43045, nameEn: 'Garlic Butter Steak Bites', nameAr: 'مكعبات لحم بصوص الثوم والأعشاب', quantity: 220, category: 'لحوم' },
  { id: 'm-43031', mealCode: 43031, nameEn: 'Tikka Chicken Masala', nameAr: 'دجاج تيكا مسالا دايت مع أرز', quantity: 305, category: 'دجاج' },
  { id: 'm-43049', mealCode: 43049, nameEn: 'Creamy Mushroom Chicken', nameAr: 'دجاج بكريمة الفطر الخفيفة مع بطاطا', quantity: 285, category: 'دجاج' },
  { id: 'm-43051', mealCode: 43051, nameEn: 'Rosemary Lamb Chops with Couscous', nameAr: 'ريش لحم بالروزماري مع كسكسي', quantity: 140, category: 'لحوم' },
  { id: 'm-43047', mealCode: 43047, nameEn: 'Grilled Salmon with Asparagus', nameAr: 'سلمون مشوي مع هليون وبطاطس', quantity: 190, category: 'مأكولات بحرية' },
  { id: 'm-43176', mealCode: 43176, nameEn: 'Shish Tawook Plate', nameAr: 'صحن شيش طاووق مشوي مع خضار وأرز', quantity: 360, category: 'دجاج' },

  // 2. Main Tray - Undivided (54 meals)
  { id: 'm-43000', mealCode: 43000, nameEn: 'Chicken Alfredo Pasta', nameAr: 'باستا الدجاج بصلصة الألفريدو الخفيفة', quantity: 310, category: 'باستا' },
  { id: 'm-42998', mealCode: 42998, nameEn: 'Spaghetti Bolognese Fit', nameAr: 'سباغيتي بولونيز لحم صحي', quantity: 290, category: 'باستا' },
  { id: 'm-42985', mealCode: 42985, nameEn: 'Chicken Saffron Risotto', nameAr: 'ريزوتو الدجاج والزعفران', quantity: 185, category: 'أطباق رئيسية' },
  { id: 'm-42986', mealCode: 42986, nameEn: 'Beef Lasagna Light', nameAr: 'لازانيا لحم لايت بجبنة قليلة الدسم', quantity: 240, category: 'باستا' },
  { id: 'm-43016', mealCode: 43016, nameEn: 'Penne Arrabbiata with Chicken', nameAr: 'بيني أرابياتا مع قطع دجاج مشوي', quantity: 275, category: 'باستا' },
  { id: 'm-42987', mealCode: 42987, nameEn: 'Truffle Mushroom Pasta', nameAr: 'باستا المشروم والكمأة', quantity: 165, category: 'باستا' },
  { id: 'm-42989', mealCode: 42989, nameEn: 'Chicken Mac & Cheese Fit', nameAr: 'ماك آند تشيز دجاج صحي', quantity: 225, category: 'باستا' },
  { id: 'm-43014', mealCode: 43014, nameEn: 'Chicken Quesadilla', nameAr: 'كاساديا الدجاج والجبن الخفيف', quantity: 195, category: 'سندوتشات' },
  { id: 'm-43009', mealCode: 43009, nameEn: 'Beef Burger Fit in Brioche', nameAr: 'برجر لحم صحي بخبز البريوش', quantity: 320, category: 'برجر' },
  { id: 'm-42993', mealCode: 42993, nameEn: 'Grilled Chicken Avocado Sandwich', nameAr: 'ساندوتش دجاج مشوي مع أفوكادو', quantity: 260, category: 'سندوتشات' },
  { id: 'm-43001', mealCode: 43001, nameEn: 'Tuna Salad Wrap', nameAr: 'راب تونة مع صوص لايت وخس', quantity: 210, category: 'سندوتشات' },
  { id: 'm-42991', mealCode: 42991, nameEn: 'Grilled Halloumi Sandwich', nameAr: 'ساندوتش حلومي مشوي مع زعتر وطماطم', quantity: 235, category: 'إفطار' },
  { id: 'm-42992', mealCode: 42992, nameEn: 'Protein Spinach Omelette', nameAr: 'أومليت البيض بالسبانخ والجبن', quantity: 190, category: 'إفطار' },
  { id: 'm-43010', mealCode: 43010, nameEn: 'Zahi Shakshuka Plate', nameAr: 'شكشوكة زاهي الخاصة مع خبز بر', quantity: 180, category: 'إفطار' },
  { id: 'm-42990', mealCode: 42990, nameEn: 'Scrambled Eggs with Avocado', nameAr: 'بيض مخفوق مع شرائح أفوكادو', quantity: 170, category: 'إفطار' },
  { id: 'm-43017', mealCode: 43017, nameEn: 'Protein Pancake with Honey', nameAr: 'بان كيك بروتين مع العسل الطبيعي', quantity: 250, category: 'إفطار' },
  { id: 'm-42995', mealCode: 42995, nameEn: 'Protein Waffle with Berries', nameAr: 'وافل البروتين بالتوت البري', quantity: 215, category: 'إفطار' },
  { id: 'm-42997', mealCode: 42997, nameEn: 'French Toast Fit', nameAr: 'فرنش توست صحي مع شراب القيقب الخفيف', quantity: 205, category: 'إفطار' },
  { id: 'm-43005', mealCode: 43005, nameEn: 'Peanut Butter Oatmeal', nameAr: 'شوفان بزبدة الفول السوداني وبذور الشيا', quantity: 240, category: 'إفطار' },
  { id: 'm-43006', mealCode: 43006, nameEn: 'Greek Yogurt Granola Bowl', nameAr: 'جرانولا مع زبادي يوناني وتوت', quantity: 280, category: 'إفطار' },
  { id: 'm-43011', mealCode: 43011, nameEn: 'Mango Chia Seed Pudding', nameAr: 'بودينغ بذور الشيا بالمانجو', quantity: 195, category: 'إفطار' },
  { id: 'm-43013', mealCode: 43013, nameEn: 'Beef Tenderloin Wrap', nameAr: 'راب ستيك لحم مشوي مع صوص مشروم', quantity: 225, category: 'سندوتشات' },
  { id: 'm-42996', mealCode: 42996, nameEn: 'Light Chicken Curry Bowl', nameAr: 'كاري الدجاج الخفيف مع خضار', quantity: 265, category: 'أطباق رئيسية' },
  { id: 'm-43068', mealCode: 43068, nameEn: 'Chicken Pesto Pasta', nameAr: 'باستا الدجاج بصلصة البيستو الطازجة', quantity: 295, category: 'باستا' },
  { id: 'm-43055', mealCode: 43055, nameEn: 'Chicken Stir-Fry Noodles', nameAr: 'نودلز الدجاج والخضار على الطريقة الآسيوية', quantity: 330, category: 'نودلز' },
  { id: 'm-43024', mealCode: 43024, nameEn: 'Mongolian Beef Fit', nameAr: 'لحم منغولي صحي بصلصة الصويا الخفيفة', quantity: 210, category: 'لحوم' },
  { id: 'm-43065', mealCode: 43065, nameEn: 'Sweet & Sour Chicken Fit', nameAr: 'دجاج حامض حلو صحي مع فلفل رومي', quantity: 270, category: 'دجاج' },
  { id: 'm-43020', mealCode: 43020, nameEn: 'Chicken Caesar Wrap', nameAr: 'راب دجاج سيزر بخبز التورتيلا الأسمر', quantity: 285, category: 'سندوتشات' },
  { id: 'm-43029', mealCode: 43029, nameEn: 'Turkey & Cheese Fit Croissant', nameAr: 'كرواسون حبوب كاملة بالديك الرومي والجبن', quantity: 175, category: 'إفطار' },
  { id: 'm-43062', mealCode: 43062, nameEn: 'Crispy Baked Chicken Tenders', nameAr: 'تندرز دجاج مقرمش مشوي بالفرن', quantity: 340, category: 'دجاج' },
  { id: 'm-43054', mealCode: 43054, nameEn: 'BBQ Pulled Chicken Bowl', nameAr: 'بولد تشيكن باربيكيو مع ذرة مشوية', quantity: 255, category: 'دجاج' },
  { id: 'm-43040', mealCode: 43040, nameEn: 'Baked Falafel Bowl', nameAr: 'فلافل مخبوزة بالفرن مع حمص وطحينة', quantity: 220, category: 'نباتي' },
  { id: 'm-43041', mealCode: 43041, nameEn: 'Steak & Egg Protein Plate', nameAr: 'صحن ستيك وبيض عالي البروتين', quantity: 185, category: 'إفطار' },
  { id: 'm-43043', mealCode: 43043, nameEn: 'Mushroom & Herb Risotto', nameAr: 'ريزوتو المشروم والأعشاب الإيطالية', quantity: 160, category: 'أطباق رئيسية' },
  { id: 'm-43056', mealCode: 43056, nameEn: 'Grilled Salmon Wrap', nameAr: 'راب سلمون مشوي مع جرجير وصوص ليمون', quantity: 175, category: 'سندوتشات' },
  { id: 'm-43057', mealCode: 43057, nameEn: 'Spicy Cajun Chicken Pasta', nameAr: 'باستا دجاج كاجون الحار', quantity: 280, category: 'باستا' },
  { id: 'm-43064', mealCode: 43064, nameEn: 'Smoked Turkey Club Fit', nameAr: 'كلوب ساندوتش ديك رومي مدخن صحي', quantity: 190, category: 'سندوتشات' },
  { id: 'm-43037', mealCode: 43037, nameEn: 'Mediterranean Roast Beef Sandwich', nameAr: 'ساندوتش روست بيف على الطريقة المتوسطية', quantity: 165, category: 'سندوتشات' },
  { id: 'm-43021', mealCode: 43021, nameEn: 'Chicken Shawarma Wrap', nameAr: 'ساندوتش شاورما دجاج لايت بخبز الصاج', quantity: 350, category: 'سندوتشات' },
  { id: 'm-43042', mealCode: 43042, nameEn: 'Protein French Crêpe', nameAr: 'كريب بروتين بحشوة الشوكولاتة الداكنة والموز', quantity: 210, category: 'إفطار' },
  { id: 'm-43039', mealCode: 43039, nameEn: 'Low-Carb Shepherd Pie', nameAr: 'فطيرة الراعي قليلة الكربوهيدرات', quantity: 155, category: 'لحوم' },
  { id: 'm-43022', mealCode: 43022, nameEn: 'Buffalo Chicken Bowl', nameAr: 'دجاج بافلو حار وصحي مع أرز قرنبيط', quantity: 205, category: 'دجاج' },
  { id: 'm-43175', mealCode: 43175, nameEn: 'Philly Cheese Steak Fit', nameAr: 'فيلي تشيز ستيك صحي بجبنة لايت', quantity: 240, category: 'سندوتشات' },
  { id: 'm-43027', mealCode: 43027, nameEn: 'Grilled Halloumi & Tapenade Sandwich', nameAr: 'ساندوتش حلومي مشوي مع معجون الزيتون', quantity: 180, category: 'إفطار' },
  { id: 'm-43066', mealCode: 43066, nameEn: 'Teriyaki Beef Noodles', nameAr: 'نودلز لحم ترياكي مع بروكلي', quantity: 260, category: 'نودلز' },
  { id: 'm-43067', mealCode: 43067, nameEn: 'Thai Red Curry Chicken', nameAr: 'كاري أحمر تايلاندي بالدجاج وحليب جوز الهند', quantity: 225, category: 'أطباق رئيسية' },
  { id: 'm-43063', mealCode: 43063, nameEn: 'Tuscan Garlic Chicken', nameAr: 'دجاج توسكان بصلصة الثوم والطماطم المجففة', quantity: 235, category: 'دجاج' },
  { id: 'm-43030', mealCode: 43030, nameEn: 'Avocado Egg Toast on Sourdough', nameAr: 'توست ساوردو مع أفوكادو مهروس وبيض', quantity: 270, category: 'إفطار' },
  { id: 'm-43059', mealCode: 43059, nameEn: 'Protein Acai Bowl', nameAr: 'وعاء الآساي عالي البروتين مع مكسرات وتوت', quantity: 310, category: 'إفطار' },
  { id: 'm-43050', mealCode: 43050, nameEn: 'Beef Chili Con Carne Fit', nameAr: 'تشيلي كون كارني لحم صحي مع أرز بني', quantity: 195, category: 'لحوم' },
  { id: 'm-43053', mealCode: 43053, nameEn: 'Lemon Pepper Chicken Fillet', nameAr: 'فيليه دجاج بالفلفل الأسود والليمون', quantity: 265, category: 'دجاج' },
  { id: 'm-43046', mealCode: 43046, nameEn: 'Grilled Salmon Poke Bowl', nameAr: 'سالمون بوكي بول مع أرز سوشي بني وإدامامي', quantity: 230, category: 'مأكولات بحرية' },
  { id: 'm-43048', mealCode: 43048, nameEn: 'Spicy Tuna Melt Fit', nameAr: 'تونة حارة ذائبة على خبز الشوفان', quantity: 185, category: 'سندوتشات' },
  { id: 'm-43052', mealCode: 43052, nameEn: 'Zaatar & Cheese Fit Manousheh', nameAr: 'منقوشة زعتر وجبنة عكاوي لايت', quantity: 290, category: 'إفطار' },

  // 3. Salad Tray (16 meals)
  { id: 'm-43070', mealCode: 43070, nameEn: 'Grilled Chicken Caesar Salad', nameAr: 'سلطة سيزر بالدجاج المشوي', quantity: 380, category: 'سلطات' },
  { id: 'm-43168', mealCode: 43168, nameEn: 'Greek Salad with Feta', nameAr: 'سلطة يونانية بجبنة الفيتا وزيتون كالاماتا', quantity: 290, category: 'سلطات' },
  { id: 'm-43074', mealCode: 43074, nameEn: 'Quinoa & Roasted Veggies Salad', nameAr: 'سلطة كينوا بالخضار المشوية والليمون', quantity: 220, category: 'سلطات' },
  { id: 'm-43075', mealCode: 43075, nameEn: 'Tuna High-Protein Salad', nameAr: 'سلطة التونة الغنية بالبروتين والبيض المسلوق', quantity: 275, category: 'سلطات' },
  { id: 'm-43069', mealCode: 43069, nameEn: 'Beetroot & Rocca Salad with Walnuts', nameAr: 'سلطة جرجير وشمندر مع الجوز والبلسميك', quantity: 240, category: 'سلطات' },
  { id: 'm-43072', mealCode: 43072, nameEn: 'Halloumi & Pomegranate Salad', nameAr: 'سلطة الحلومي المشوي ودبس الرمان', quantity: 265, category: 'سلطات' },
  { id: 'm-43073', mealCode: 43073, nameEn: 'Chicken Avocado Salad', nameAr: 'سلطة الدجاج الطازج بالأفوكادو والطماطم', quantity: 310, category: 'سلطات' },
  { id: 'm-43172', mealCode: 43172, nameEn: 'Grilled Salmon Garden Salad', nameAr: 'سلطة السلمون والخضار الطازجة', quantity: 195, category: 'سلطات' },
  { id: 'm-43076', mealCode: 43076, nameEn: 'Green Detox Salad', nameAr: 'سلطة الديتوكس الخضراء بالخيار والنعناع والكرفس', quantity: 180, category: 'سلطات' },
  { id: 'm-43071', mealCode: 43071, nameEn: 'Edamame & Crab Salad', nameAr: 'سلطة الإدامامي والكابوريا بصلصة السمسم', quantity: 215, category: 'سلطات' },
  { id: 'm-43167', mealCode: 43167, nameEn: 'Mediterranean Chickpea Salad', nameAr: 'سلطة الحمص المتوسطية بالبقدونس وزيت الزيتون', quantity: 230, category: 'سلطات' },
  { id: 'm-43079', mealCode: 43079, nameEn: 'Asian Crunchy Chicken Salad', nameAr: 'سلطة الدجاج المقرمش الآسيوية بصوص الفول السوداني', quantity: 285, category: 'سلطات' },
  { id: 'm-43078', mealCode: 43078, nameEn: 'Strawberry Spinach Salad', nameAr: 'سلطة السبانخ بالفراولة وجبنة الماعز', quantity: 190, category: 'سلطات' },
  { id: 'm-43166', mealCode: 43166, nameEn: 'Sweet Potato & Kale Salad', nameAr: 'سلطة الكيل والبطاطا الحلوة وبذور اليقطين', quantity: 205, category: 'سلطات' },
  { id: 'm-43077', mealCode: 43077, nameEn: 'Mexican Street Corn Salad', nameAr: 'سلطة الذرة المكسيكية المشوية بالكزبرة والليمون', quantity: 250, category: 'سلطات' },
  { id: 'm-43171', mealCode: 43171, nameEn: 'Superfood Lentil Salad', nameAr: 'سلطة العدس سوپرفود بالرمان والرمان المجفف', quantity: 210, category: 'سلطات' },
];

/**
 * Realistic, date-variable daily meal consumption schedules specifically for Oct 20 - 24, 2026.
 * Each day features varying meal items and dynamic quantities spanning all packaging categories:
 * Divided Trays, Undivided Trays, Salad Trays, and Cutlery.
 */
export const DAILY_QUANTITY_SCHEDULE: Record<string, Array<{ mealCode: number; quantity: number }>> = {
  // Day 1: Tuesday, October 20, 2026 (18 items, distinct menu)
  '2026-10-20': [
    // Divided
    { mealCode: 43015, quantity: 75 },
    { mealCode: 43160, quantity: 60 },
    { mealCode: 42999, quantity: 45 },
    { mealCode: 42994, quantity: 85 },
    { mealCode: 43004, quantity: 50 },
    { mealCode: 42988, quantity: 40 },
    // Undivided
    { mealCode: 43000, quantity: 65 },
    { mealCode: 42998, quantity: 70 },
    { mealCode: 42985, quantity: 35 },
    { mealCode: 42986, quantity: 55 },
    { mealCode: 43016, quantity: 60 },
    { mealCode: 42987, quantity: 30 },
    { mealCode: 43068, quantity: 65 },
    { mealCode: 43055, quantity: 75 },
    // Salad
    { mealCode: 43070, quantity: 80 },
    { mealCode: 43168, quantity: 60 },
    { mealCode: 43074, quantity: 50 },
    { mealCode: 43075, quantity: 55 },
  ],

  // Day 2: Wednesday, October 21, 2026 (21 items, rotation menu)
  '2026-10-21': [
    // Divided
    { mealCode: 43018, quantity: 65 },
    { mealCode: 43003, quantity: 40 },
    { mealCode: 43002, quantity: 70 },
    { mealCode: 43012, quantity: 55 },
    { mealCode: 43181, quantity: 35 },
    { mealCode: 43008, quantity: 60 },
    { mealCode: 43015, quantity: 80 },
    // Undivided
    { mealCode: 42989, quantity: 45 },
    { mealCode: 43014, quantity: 40 },
    { mealCode: 43009, quantity: 70 },
    { mealCode: 42993, quantity: 55 },
    { mealCode: 43001, quantity: 45 },
    { mealCode: 42991, quantity: 50 },
    { mealCode: 43024, quantity: 45 },
    { mealCode: 43040, quantity: 50 },
    { mealCode: 43065, quantity: 60 },
    { mealCode: 43020, quantity: 60 },
    // Salad
    { mealCode: 43069, quantity: 50 },
    { mealCode: 43072, quantity: 55 },
    { mealCode: 43073, quantity: 65 },
    { mealCode: 43172, quantity: 40 },
  ],

  // Day 3: Thursday, October 22, 2026 (22 items, high-volume prep)
  '2026-10-22': [
    // Divided
    { mealCode: 43032, quantity: 75 },
    { mealCode: 43026, quantity: 50 },
    { mealCode: 43038, quantity: 55 },
    { mealCode: 43060, quantity: 90 },
    { mealCode: 43061, quantity: 40 },
    { mealCode: 43045, quantity: 45 },
    { mealCode: 43031, quantity: 65 },
    { mealCode: 43160, quantity: 65 },
    // Undivided
    { mealCode: 42992, quantity: 40 },
    { mealCode: 43010, quantity: 35 },
    { mealCode: 42990, quantity: 35 },
    { mealCode: 43017, quantity: 55 },
    { mealCode: 42995, quantity: 45 },
    { mealCode: 42997, quantity: 45 },
    { mealCode: 43000, quantity: 70 },
    { mealCode: 42998, quantity: 65 },
    { mealCode: 43055, quantity: 70 },
    // Salad
    { mealCode: 43076, quantity: 40 },
    { mealCode: 43071, quantity: 45 },
    { mealCode: 43167, quantity: 50 },
    { mealCode: 43079, quantity: 60 },
    { mealCode: 43070, quantity: 80 },
  ],

  // Day 4: Friday, October 23, 2026 (17 items, weekend rotation)
  '2026-10-23': [
    // Divided
    { mealCode: 43049, quantity: 60 },
    { mealCode: 43051, quantity: 30 },
    { mealCode: 43047, quantity: 40 },
    { mealCode: 43176, quantity: 75 },
    { mealCode: 43015, quantity: 85 },
    { mealCode: 43004, quantity: 55 },
    // Undivided
    { mealCode: 43005, quantity: 50 },
    { mealCode: 43006, quantity: 60 },
    { mealCode: 43011, quantity: 40 },
    { mealCode: 43013, quantity: 50 },
    { mealCode: 42996, quantity: 55 },
    { mealCode: 43024, quantity: 50 },
    { mealCode: 43068, quantity: 70 },
    // Salad
    { mealCode: 43078, quantity: 40 },
    { mealCode: 43166, quantity: 45 },
    { mealCode: 43077, quantity: 55 },
    { mealCode: 43171, quantity: 45 },
  ],

  // Day 5: Saturday, October 24, 2026 (22 items, peak prep)
  '2026-10-24': [
    // Divided
    { mealCode: 43015, quantity: 80 },
    { mealCode: 43160, quantity: 70 },
    { mealCode: 42988, quantity: 45 },
    { mealCode: 43018, quantity: 65 },
    { mealCode: 43032, quantity: 75 },
    { mealCode: 43060, quantity: 85 },
    { mealCode: 43176, quantity: 75 },
    // Undivided
    { mealCode: 43029, quantity: 40 },
    { mealCode: 43062, quantity: 75 },
    { mealCode: 43054, quantity: 55 },
    { mealCode: 43041, quantity: 40 },
    { mealCode: 43043, quantity: 35 },
    { mealCode: 43056, quantity: 40 },
    { mealCode: 43000, quantity: 75 },
    { mealCode: 43040, quantity: 50 },
    { mealCode: 43055, quantity: 75 },
    { mealCode: 43068, quantity: 70 },
    // Salad
    { mealCode: 43070, quantity: 85 },
    { mealCode: 43168, quantity: 65 },
    { mealCode: 43072, quantity: 60 },
    { mealCode: 43073, quantity: 70 },
    { mealCode: 43077, quantity: 55 },
  ],
};

/**
 * Returns dynamic meal rows aggregated over the specified date range.
 * Calculates dynamic quantities and items based on dateFrom and dateTo.
 */
export function getMealsForDateRange(dateFrom: string, dateTo: string): QuantityMealRow[] {
  const start = dateFrom || '2026-10-20';
  const end = dateTo || '2026-10-24';

  const aggregatedMap = new Map<number, number>();

  // Collect all dates in range
  const current = new Date(start);
  const endDate = new Date(end);

  let daysCount = 0;
  if (!isNaN(current.getTime()) && !isNaN(endDate.getTime())) {
    while (current <= endDate && daysCount < 31) {
      const dateStr = current.toISOString().split('T')[0];
      const dayMeals = DAILY_QUANTITY_SCHEDULE[dateStr];
      if (dayMeals) {
        for (const item of dayMeals) {
          aggregatedMap.set(item.mealCode, (aggregatedMap.get(item.mealCode) || 0) + item.quantity);
        }
      } else {
        // Deterministic fallback for dates outside 20-24:
        const dayOfMonth = current.getDate();
        const fallbackMeals = INITIAL_QUANTITY_MEALS.slice((dayOfMonth * 3) % 20, ((dayOfMonth * 3) % 20) + 15);
        for (const m of fallbackMeals) {
          const qty = 30 + ((m.mealCode * dayOfMonth) % 50);
          aggregatedMap.set(m.mealCode, (aggregatedMap.get(m.mealCode) || 0) + qty);
        }
      }
      current.setDate(current.getDate() + 1);
      daysCount++;
    }
  }

  // If no dates matched, return all 5 days aggregated as default
  if (aggregatedMap.size === 0) {
    Object.values(DAILY_QUANTITY_SCHEDULE).forEach((dayList) => {
      dayList.forEach((item) => {
        aggregatedMap.set(item.mealCode, (aggregatedMap.get(item.mealCode) || 0) + item.quantity);
      });
    });
  }

  // Create dictionary lookup from INITIAL_QUANTITY_MEALS
  const metaMap = new Map<number, QuantityMealRow>();
  INITIAL_QUANTITY_MEALS.forEach((item) => {
    metaMap.set(item.mealCode, item);
  });

  const result: QuantityMealRow[] = [];
  aggregatedMap.forEach((qty, mealCode) => {
    const meta = metaMap.get(mealCode);
    if (meta) {
      result.push({
        id: `m-${mealCode}`,
        mealCode,
        nameEn: meta.nameEn,
        nameAr: meta.nameAr,
        quantity: qty,
        category: meta.category,
      });
    }
  });

  return result.sort((a, b) => a.mealCode - b.mealCode);
}

