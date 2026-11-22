import { db, storeCategoriesTable, storeProductsTable, usersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

export async function ensureStoreSeedData() {
  try {
    const [catCount] = await db.select({ total: count() }).from(storeCategoriesTable);
    if ((catCount?.total ?? 0) > 0) {
      return; // Already initialized
    }

    console.log("[StoreSeed] Initializing official JNV Store categories and products...");

    // Find or fallback to first user for createdBy
    let [adminUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "official")).limit(1);
    if (!adminUser) {
      [adminUser] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    }
    if (!adminUser) {
      console.warn("[StoreSeed] No user available in database yet. Categories will be created without products.");
    }

    // 1. Initial 9 Categories
    const categoriesData = [
      {
        name: "Navodayan Merchandise",
        description: "Official JNV badges, pins, flags, crests & souvenirs",
        imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Clothing & Apparel",
        description: "Hoodies, t-shirts, jackets and house uniforms",
        imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Bags & Backpacks",
        description: "Durable school bags, laptop backpacks & duffels",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Stationery",
        description: "Notebooks, diary combos, pens, math sets & exam pads",
        imageUrl: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Books & Educational Accessories",
        description: "Competitive exam kits, study guides & book lights",
        imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Water Bottles & Accessories",
        description: "Stainless steel sippers, thermal flasks & lunch sets",
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Gifts & Personalized Products",
        description: "Engraved pens, customized mugs & memory photo frames",
        imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Alumni Reunion Merchandise",
        description: "Batch mementos, silver jubilee kits & reunion polos",
        imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
      {
        name: "Other Approved Products",
        description: "Campus accessories, sports gear & dorm essentials",
        imageUrl: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80",
        visible: true,
      },
    ];

    const insertedCategories = await db.insert(storeCategoriesTable).values(categoriesData).returning();
    const catMap = new Map(insertedCategories.map(c => [c.name, c.id]));

    if (!adminUser) return;

    // 2. Initial High-Quality Products
    const productsData = [
      {
        name: "Navodaya Crest Premium Cotton Hoodie",
        description: "Heavyweight 360 GSM fleece hoodie featuring the embossed Navodaya crest on the chest. Designed for winter warmth on campus and alumni reunions. Double-stitched seams and kangaroo pocket.",
        brand: "Navodaya Heritage",
        sku: "NV-CLOTH-HD01",
        categoryId: catMap.get("Clothing & Apparel"),
        pricePaise: 129900,
        originalPricePaise: 189900,
        discountPercent: 32,
        stock: 85,
        status: "published",
        featured: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Material": "100% Super-combed Fleece Cotton",
          "GSM": "360 GSM",
          "Fit": "Regular Unisex Fit",
          "Origin": "Made in India",
          "Wash Care": "Machine wash cold inside out",
        },
        variants: [
          {
            name: "Size",
            options: [
              { value: "S", stock: 15 },
              { value: "M", stock: 30 },
              { value: "L", stock: 25 },
              { value: "XL", stock: 15 },
            ],
          },
          {
            name: "Color",
            options: [
              { value: "Deep Navy", stock: 50 },
              { value: "Maroon", stock: 35 },
            ],
          },
        ],
      },
      {
        name: "JNV Campus Ergonomic Backpack (32L)",
        description: "Specially engineered 32L water-resistant school backpack with padded laptop sleeve, separate book compartment, reflective safety trim, and heavy-duty SBS zippers. Tested for rugged campus daily use.",
        brand: "Navodaya Gear",
        sku: "NV-BAG-BP32",
        categoryId: catMap.get("Bags & Backpacks"),
        pricePaise: 89900,
        originalPricePaise: 149900,
        discountPercent: 40,
        stock: 120,
        status: "published",
        featured: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Capacity": "32 Litres",
          "Laptop Size": "Up to 15.6 inch",
          "Material": "900D Ballistic Water-Repellent Polyester",
          "Warranty": "1 Year Manufacturer Warranty",
        },
        variants: [
          {
            name: "Color",
            options: [
              { value: "Midnight Black", stock: 70 },
              { value: "Royal Blue", stock: 50 },
            ],
          },
        ],
      },
      {
        name: "Navodaya Insulated Stainless Steel Sipper (750ml)",
        description: "Double-wall vacuum insulated food-grade 304 stainless steel bottle. Keeps water cold for 24 hours or hot for 12 hours. Sweat-proof exterior with laser-engraved Navodaya Connect emblem.",
        brand: "AquaNav",
        sku: "NV-BOT-SS75",
        categoryId: catMap.get("Water Bottles & Accessories"),
        pricePaise: 49900,
        originalPricePaise: 79900,
        discountPercent: 37,
        stock: 200,
        status: "published",
        featured: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1570572858059-e93815c3ec04?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Volume": "750 ml",
          "Material": "SUS 304 Food-Grade Stainless Steel",
          "Insulation": "Double-Wall Vacuum",
          "BPA Free": "Yes",
        },
        variants: [
          {
            name: "Finish",
            options: [
              { value: "Matte Black", stock: 110 },
              { value: "Brushed Steel", stock: 90 },
            ],
          },
        ],
      },
      {
        name: "Official JNV House Badge & Lapel Pin Collector Set",
        description: "Collector's 4-piece die-cast metal lapel pin set honoring the four houses of Navodaya Vidyalaya: Aravali, Nilgiri, Shivalik, and Udaygiri. Gold-plated trim with durable butterfly clutch.",
        brand: "Navodaya Heritage",
        sku: "NV-MERCH-PIN04",
        categoryId: catMap.get("Navodayan Merchandise"),
        pricePaise: 29900,
        originalPricePaise: 49900,
        discountPercent: 40,
        stock: 350,
        status: "published",
        featured: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Pieces": "Set of 4 Enamel Pins",
          "Material": "Zinc Alloy with Soft Enamel",
          "Plating": "Polished Gold Tone",
          "Attachment": "Metal Butterfly Clutch",
        },
        variants: [],
      },
      {
        name: "Executive JNV Leatherette Diary & Pen Combo",
        description: "Hardbound PU leather journal with 240 acid-free ruled pages, bookmark ribbon, document pocket, and a laser-engraved twist ballpoint pen. Ideal for students, teachers, and alumni alike.",
        brand: "Navodaya Stationery",
        sku: "NV-STAT-DRY01",
        categoryId: catMap.get("Stationery"),
        pricePaise: 39900,
        originalPricePaise: 59900,
        discountPercent: 33,
        stock: 140,
        status: "published",
        featured: false,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Cover": "Premium Vegan Leatherette",
          "Pages": "240 Ruled Pages (80 GSM)",
          "Pen Included": "Metal Twist Ballpoint (Blue Ink)",
        },
        variants: [
          {
            name: "Cover Color",
            options: [
              { value: "Classic Tan", stock: 80 },
              { value: "Executive Navy", stock: 60 },
            ],
          },
        ],
      },
      {
        name: "Alumni Reunion Silver Jubilee Commemorative Polo",
        description: "100% Pique cotton breathable polo shirt with tipping collar, mother-of-pearl buttons, and silver embroidered 'Navodaya Alumni Reunion' crest. Preshrunk bio-washed fabric.",
        brand: "Navodaya Alumni Assoc.",
        sku: "NV-ALUM-POLO25",
        categoryId: catMap.get("Alumni Reunion Merchandise"),
        pricePaise: 79900,
        originalPricePaise: 119900,
        discountPercent: 33,
        stock: 95,
        status: "published",
        featured: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Fabric": "240 GSM 100% Combed Cotton Pique",
          "Pattern": "Classic Fit Polo with Ribbed Collar",
          "Embroidery": "Silver Lurex Thread Crest",
        },
        variants: [
          {
            name: "Size",
            options: [
              { value: "M", stock: 35 },
              { value: "L", stock: 40 },
              { value: "XL", stock: 20 },
            ],
          },
        ],
      },
      {
        name: "CBSE & Navodaya Competitive Exam Desk Lamp",
        description: "Rechargeable 3-level dimmable LED study lamp with flexible gooseneck, built-in pen stand, and eye-protection warm light filter. Battery lasts up to 8 hours on a single USB-C charge.",
        brand: "EduTech Tools",
        sku: "NV-EDU-LAMP01",
        categoryId: catMap.get("Books & Educational Accessories"),
        pricePaise: 54900,
        originalPricePaise: 89900,
        discountPercent: 39,
        stock: 65,
        status: "published",
        featured: false,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Light Modes": "Cool White, Natural, Warm Amber",
          "Battery": "2000 mAh Li-ion Rechargeable",
          "Charging": "USB Type-C (Cable included)",
        },
        variants: [],
      },
      {
        name: "Navodaya Custom Ceramic Coffee Mug with JNV Name",
        description: "Glossy 350ml microwave and dishwasher-safe ceramic mug custom printed with the official Navodaya motto and state/JNV name. Beautiful gift for teachers, students, and batchmates.",
        brand: "Navodaya Gifts",
        sku: "NV-GIFT-MUG01",
        categoryId: catMap.get("Gifts & Personalized Products"),
        pricePaise: 24900,
        originalPricePaise: 39900,
        discountPercent: 38,
        stock: 180,
        status: "published",
        featured: false,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        images: [
          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
        ],
        specifications: {
          "Capacity": "350 ml",
          "Material": "High-Grade Ceramic",
          "Finish": "High Gloss Dye Sublimation Print",
        },
        variants: [],
      },
    ];

    await db.insert(storeProductsTable).values(productsData as any);
    console.log(`[StoreSeed] Successfully seeded 9 categories and ${productsData.length} published products.`);
  } catch (err) {
    console.error("[StoreSeed] Error seeding store data:", err);
  }
}
