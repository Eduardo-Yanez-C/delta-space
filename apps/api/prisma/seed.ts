import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { filterBlocksForApplyClean } from "../src/modules/quotes/margin-hierarchy/margin-hierarchy.clean-blocks";

const prisma = new PrismaClient();

/** Plantilla MARGIN base persistida (misma estructura que apply-clean ON_GRID + STANDARD). */
const MARGIN_BASE_QUOTE_TEMPLATE_NAME = "Plantilla limpia MARGIN";
const MARGIN_BASE_QUOTE_TEMPLATE_DESCRIPTION =
  "Base editable para cotizaciones con margen. Incluye estructura inicial sin valorización comercial.";

const ROLE_DEFINITIONS = [
  {
    name: "ADMIN_DEV",
    description:
      "Administrador desarrollador (root): todos los permisos; gestión de roles elevados y configuración crítica.",
  },
  {
    name: "ADMIN",
    description:
      "Administrador operativo: módulos principales y gestión de usuarios subordinados (no ADMIN ni ADMIN_DEV).",
  },
  {
    name: "VENDEDOR_TECNICO",
    description:
      "Vendedor técnico: clientes, estudios FV, cotizaciones, plantillas, diseño/implantación; sin administración global.",
  },
  {
    name: "INGENIERIA",
    description: "Lectura técnica; apoyo en cálculo FV y cotizaciones.",
  },
  { name: "LECTURA", description: "Solo visualización." },
];

async function seedRolesAndAdmin() {
  for (const r of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: r,
      update: { description: r.description },
    });
  }
  console.log("  Roles: ADMIN_DEV, ADMIN, VENDEDOR_TECNICO, INGENIERIA, LECTURA sincronizados.");

  // Migrar rol legacy VENTAS → VENDEDOR_TECNICO
  const ventasRole = await prisma.role.findUnique({ where: { name: "VENTAS" } });
  const vendedorTecnicoRole = await prisma.role.findUnique({ where: { name: "VENDEDOR_TECNICO" } });
  if (ventasRole && vendedorTecnicoRole) {
    const links = await prisma.userRole.findMany({ where: { roleId: ventasRole.id } });
    for (const ur of links) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ur.userId, roleId: vendedorTecnicoRole.id } },
        create: { userId: ur.userId, roleId: vendedorTecnicoRole.id },
        update: {},
      });
    }
    await prisma.userRole.deleteMany({ where: { roleId: ventasRole.id } });
    await prisma.role.delete({ where: { id: ventasRole.id } });
    console.log("  Rol VENTAS migrado a VENDEDOR_TECNICO y eliminado.");
  }

  const adminDevRole = await prisma.role.findUnique({ where: { name: "ADMIN_DEV" } });
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (!adminDevRole || !adminRole) {
    throw new Error("Roles ADMIN_DEV o ADMIN no encontrados tras sincronizar.");
  }

  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminEmail = "eduardo.yanez.concha@gmail.com";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    create: {
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      name: "Administrador",
      active: true,
    },
    update: {
      password: hashedPassword,
      name: "Administrador",
      active: true,
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: admin.id, roleId: adminRole.id } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminDevRole.id } },
    create: { userId: admin.id, roleId: adminDevRole.id },
    update: {},
  });

  console.log("  Usuario bootstrap:", adminEmail, "/ admin123 (rol ADMIN_DEV).");
}

const CATEGORIES = [
  { name: "Paneles fotovoltaicos", slug: "paneles-fotovoltaicos" },
  { name: "Inversores on-grid", slug: "inversores-on-grid" },
  { name: "Inversores híbridos", slug: "inversores-hibridos" },
  { name: "Inversores off-grid", slug: "inversores-off-grid" },
  { name: "Baterías", slug: "baterias" },
  { name: "Estructuras", slug: "estructuras" },
  { name: "Protecciones AC", slug: "protecciones-ac" },
  { name: "Protecciones DC", slug: "protecciones-dc" },
  { name: "Cables", slug: "cables" },
  { name: "Conectores", slug: "conectores" },
  { name: "Tableros", slug: "tableros" },
  { name: "Monitoreo", slug: "monitoreo" },
  { name: "Mano de obra", slug: "mano-de-obra" },
  { name: "Ingeniería", slug: "ingenieria" },
  { name: "Transporte", slug: "transporte" },
  { name: "Obras civiles", slug: "obras-civiles" },
  { name: "Permisos", slug: "permisos" },
  { name: "Otros", slug: "otros" },
];

/** Clientes de prueba: no se invoca por defecto (base limpia). Mantener por si se desea un seed demo opcional. */
export async function seedClientsOptional() {
  const count = await prisma.client.count();
  if (count > 0) {
    console.log("  Clientes: ya existentes, no se modifican.");
    return;
  }
  await prisma.client.createMany({
    data: [
      {
        type: "RESIDENCIAL",
        name: "Casa Solar García",
        taxId: null,
        email: "contacto@casasolargarcia.com",
        phone: "+56 2 2123 4567",
        address: "Av. Providencia 123, Santiago",
        notes: "Cliente residencial, interés en sistema 5 kW.",
      },
      {
        type: "COMERCIAL",
        name: "Comercializadora del Norte SpA",
        taxId: "76.123.456-7",
        email: "compras@comernorte.cl",
        phone: "+56 41 234 5678",
        address: "Parque Industrial 45, Concepción",
        notes: "Cotización para cubierta 100 kW.",
      },
      {
        type: "INDUSTRIAL",
        name: "Planta Industrial del Pacífico",
        taxId: "78.456.789-2",
        email: "ingenieria@plantaPacifico.cl",
        phone: "+56 32 111 2233",
        address: "Km 12 Ruta 68, Valparaíso",
        notes: "Proyecto industrial 500 kW. Fase 1.",
      },
    ],
  });
  console.log("  Clientes: 3 creados.");
}

async function seedCatalog() {
  const hadCategoriesAtStart = (await prisma.productCategory.count()) > 0;
  const isPortableMinimal = process.env.EMBEDDED_PORTABLE_MINIMAL_SEED === "1";

  if (!hadCategoriesAtStart) {
    for (const c of CATEGORIES) {
      await prisma.productCategory.create({ data: c });
    }
    console.log("  Categorías: 18 creadas.");
  } else {
    console.log("  Categorías ya existen. Omitiendo creación de categorías.");
  }

  if (isPortableMinimal) {
    console.log("  Catálogo demo (marcas/modelos/productos/proveedores) omitido: portable mínimo.");
    return;
  }

  if (hadCategoriesAtStart) {
    console.log("  Catálogo demo omitido: la BD ya contenía categorías.");
    return;
  }

  const categoryIds: Record<string, number> = {};
  for (const row of await prisma.productCategory.findMany({ select: { id: true, slug: true } })) {
    categoryIds[row.slug] = row.id;
  }

  const brands = await Promise.all([
    prisma.brand.create({ data: { name: "Longi" } }),
    prisma.brand.create({ data: { name: "Huawei" } }),
    prisma.brand.create({ data: { name: "Fronius" } }),
    prisma.brand.create({ data: { name: "BYD" } }),
    prisma.brand.create({ data: { name: "Victron" } }),
    prisma.brand.create({ data: { name: "K2 Systems" } }),
  ]);
  const brandByName: Record<string, number> = {};
  brands.forEach((b) => (brandByName[b.name] = b.id));
  console.log("  Marcas: 6 creadas.");

  const models = await Promise.all([
    prisma.productModel.create({
      data: { brandId: brandByName["Longi"], name: "Hi-MO 6 430W" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Longi"], name: "Hi-MO 5 550W" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Huawei"], name: "SUN2000-100KTL-M1" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Huawei"], name: "LUNA2000-5-S0" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Fronius"], name: "Primo 3.6-1" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Fronius"], name: "Symo 10.0-3" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["BYD"], name: "Battery-Box HVS 5.1" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["BYD"], name: "Battery-Box HVM 11.0" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["Victron"], name: "MultiPlus-II 48/5000" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["K2 Systems"], name: "D-Dome" },
    }),
    prisma.productModel.create({
      data: { brandId: brandByName["K2 Systems"], name: "TopFix" },
    }),
  ]);
  const modelByName: Record<string, number> = {};
  models.forEach((m) => (modelByName[`${m.brandId}-${m.name}`] = m.id));
  console.log("  Modelos: 11 creados.");

  const supNac1 = await prisma.supplier.create({
    data: {
      name: "Solar Chile Distribución",
      legalName: "Solar Chile Distribución SpA",
      taxId: "76.200.100-1",
      contactName: "Juan Pérez",
      email: "ventas@solarchile.cl",
      phone: "+56 2 2876 5432",
      country: "Chile",
      city: "Santiago",
      defaultCurrency: "CLP",
      supplyOrigin: "NACIONAL",
      actorType: "DISTRIBUIDOR",
      paymentTerms: "30 días",
      leadTimeDays: 15,
      notes: "Distribuidor oficial Longi y Fronius en Chile.",
      active: true,
    },
  });
  const supNac2 = await prisma.supplier.create({
    data: {
      name: "Energía Solar Chile",
      legalName: "Energía Solar Chile Ltda",
      taxId: "77.300.200-2",
      contactName: "María González",
      email: "compras@energiasolarchile.cl",
      phone: "+56 32 234 5678",
      country: "Chile",
      city: "Valparaíso",
      defaultCurrency: "USD",
      supplyOrigin: "NACIONAL",
      actorType: "REPRESENTANTE",
      paymentTerms: "Contado 50%, saldo a 30 días",
      leadTimeDays: 20,
      notes: "Representante Huawei y BYD.",
      active: true,
    },
  });
  const supNac3 = await prisma.supplier.create({
    data: {
      name: "Importadora Fotovoltaica",
      legalName: "Importadora Fotovoltaica SpA",
      taxId: "78.400.300-3",
      contactName: "Carlos Rojas",
      email: "logistica@importfotovoltaica.cl",
      phone: "+56 41 345 6789",
      country: "Chile",
      city: "Concepción",
      defaultCurrency: "USD",
      supplyOrigin: "NACIONAL",
      actorType: "IMPORTADOR",
      paymentTerms: "60 días",
      leadTimeDays: 45,
      notes: "Importación directa desde Asia.",
      active: true,
    },
  });
  const supInt1 = await prisma.supplier.create({
    data: {
      name: "Longi Solar (OEM)",
      legalName: "Longi Green Energy Technology Co.",
      taxId: null,
      contactName: "Export Dept",
      email: "export@longi.com",
      phone: "+86 29 8187 3000",
      country: "China",
      city: "Xi'an",
      defaultCurrency: "USD",
      supplyOrigin: "INTERNACIONAL",
      actorType: "FABRICANTE",
      paymentTerms: "LC 30% advance, 70% at sight",
      leadTimeDays: 60,
      notes: "Compra directa fábrica. MOQ contenedor.",
      active: true,
    },
  });
  const supInt2 = await prisma.supplier.create({
    data: {
      name: "Huawei Digital Power",
      legalName: "Huawei Technologies",
      taxId: null,
      contactName: "Regional Sales",
      email: "solar@huawei.com",
      phone: "+49 89 998 370",
      country: "Germany",
      city: "Munich",
      defaultCurrency: "USD",
      supplyOrigin: "INTERNACIONAL",
      actorType: "DISTRIBUIDOR",
      paymentTerms: "Net 45",
      leadTimeDays: 30,
      notes: "Distribución Europa/LATAM.",
      active: true,
    },
  });
  const supInt3 = await prisma.supplier.create({
    data: {
      name: "BYD Energy Storage",
      legalName: "BYD Company Ltd",
      taxId: null,
      contactName: "Sales LATAM",
      email: "storage@byd.com",
      phone: "+86 755 8988 8888",
      country: "China",
      city: "Shenzhen",
      defaultCurrency: "USD",
      supplyOrigin: "INTERNACIONAL",
      actorType: "IMPORTADOR",
      paymentTerms: "T/T 30% advance",
      leadTimeDays: 90,
      notes: "Baterías y sistemas de almacenamiento.",
      active: true,
    },
  });
  console.log("  Proveedores: 6 creados (3 nacionales, 3 internacionales).");

  const cat = (slug: string) => categoryIds[slug];
  const brand = (name: string) => brandByName[name];
  const model = (brandName: string, modelName: string) =>
    modelByName[`${brandByName[brandName]}-${modelName}`];

  const panel1 = await prisma.product.create({
    data: {
      name: "Panel Longi Hi-MO 6 430W",
      description: "Panel monocristalino 430W, 22.3% eficiencia.",
      internalCode: "PV-LG-430",
      sku: "LONGI-HiMO6-430",
      categoryId: cat("paneles-fotovoltaicos"),
      brandId: brand("Longi"),
      modelId: model("Longi", "Hi-MO 6 430W"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "25 años lineal",
      leadTimeDays: 30,
      origin: "China",
      primarySupplierId: supNac1.id,
    },
  });
  await prisma.productSupplier.createMany({
    data: [
      {
        productId: panel1.id,
        supplierId: supNac1.id,
        isPrimary: true,
        isAlternative: false,
        leadTimeDays: 15,
        moq: "10 unidades",
        warranty: "25 años",
      },
      {
        productId: panel1.id,
        supplierId: supInt1.id,
        isPrimary: false,
        isAlternative: true,
        leadTimeDays: 60,
        moq: "1 contenedor",
        warranty: "25 años",
      },
    ],
  });

  const panel2 = await prisma.product.create({
    data: {
      name: "Panel Longi Hi-MO 5 550W",
      description: "Panel monocristalino 550W, alta potencia.",
      internalCode: "PV-LG-550",
      sku: "LONGI-HiMO5-550",
      categoryId: cat("paneles-fotovoltaicos"),
      brandId: brand("Longi"),
      modelId: model("Longi", "Hi-MO 5 550W"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "25 años lineal",
      leadTimeDays: 30,
      origin: "China",
      primarySupplierId: supInt1.id,
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: panel2.id,
      supplierId: supInt1.id,
      isPrimary: true,
      isAlternative: false,
      leadTimeDays: 60,
      moq: "1 contenedor",
    },
  });

  const panel3 = await prisma.product.create({
    data: {
      name: "Panel Longi Hi-MO 6 430W (lote alternativo)",
      description: "Mismo modelo, canal alternativo.",
      internalCode: "PV-LG-430-ALT",
      categoryId: cat("paneles-fotovoltaicos"),
      brandId: brand("Longi"),
      modelId: model("Longi", "Hi-MO 6 430W"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      primarySupplierId: supNac3.id,
    },
  });
  await prisma.productSupplier.createMany({
    data: [
      {
        productId: panel3.id,
        supplierId: supNac3.id,
        isPrimary: true,
        isAlternative: false,
        leadTimeDays: 45,
      },
      {
        productId: panel3.id,
        supplierId: supNac1.id,
        isPrimary: false,
        isAlternative: true,
      },
    ],
  });

  const invOn1 = await prisma.product.create({
    data: {
      name: "Inversor Huawei SUN2000-100KTL-M1",
      description: "Inversor string 100 kW, 20 MPPTs.",
      internalCode: "INV-HW-100K",
      categoryId: cat("inversores-on-grid"),
      brandId: brand("Huawei"),
      modelId: model("Huawei", "SUN2000-100KTL-M1"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "10 años",
      leadTimeDays: 25,
      primarySupplierId: supInt2.id,
      inverterType: "ON_GRID",
    },
  });
  await prisma.productSupplier.createMany({
    data: [
      {
        productId: invOn1.id,
        supplierId: supInt2.id,
        isPrimary: true,
        isAlternative: false,
        leadTimeDays: 30,
      },
      {
        productId: invOn1.id,
        supplierId: supNac2.id,
        isPrimary: false,
        isAlternative: true,
        leadTimeDays: 20,
      },
    ],
  });

  const invOn2 = await prisma.product.create({
    data: {
      name: "Inversor Fronius Primo 3.6-1",
      description: "Inversor monofásico 3.6 kW.",
      internalCode: "INV-FRO-3.6",
      categoryId: cat("inversores-on-grid"),
      brandId: brand("Fronius"),
      modelId: model("Fronius", "Primo 3.6-1"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "5 años extensible",
      primarySupplierId: supNac1.id,
      connectionType: "MONOFASICO",
      inverterType: "ON_GRID",
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: invOn2.id,
      supplierId: supNac1.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const invOn3 = await prisma.product.create({
    data: {
      name: "Inversor Fronius Symo 10.0-3",
      description: "Inversor trifásico 10 kW.",
      internalCode: "INV-FRO-10",
      categoryId: cat("inversores-on-grid"),
      brandId: brand("Fronius"),
      modelId: model("Fronius", "Symo 10.0-3"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "5 años",
      primarySupplierId: supNac1.id,
      connectionType: "TRIFASICO",
      inverterType: "ON_GRID",
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: invOn3.id,
      supplierId: supNac1.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const invHy1 = await prisma.product.create({
    data: {
      name: "Inversor híbrido Huawei LUNA2000-5-S0",
      description: "Sistema híbrido 5 kWh con inversor integrado.",
      internalCode: "INV-HW-LUNA5",
      categoryId: cat("inversores-hibridos"),
      brandId: brand("Huawei"),
      modelId: model("Huawei", "LUNA2000-5-S0"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "10 años",
      primarySupplierId: supNac2.id,
      inverterType: "HYBRID",
    },
  });
  await prisma.productSupplier.createMany({
    data: [
      {
        productId: invHy1.id,
        supplierId: supNac2.id,
        isPrimary: true,
        isAlternative: false,
      },
      {
        productId: invHy1.id,
        supplierId: supInt2.id,
        isPrimary: false,
        isAlternative: true,
      },
    ],
  });

  const invHy2 = await prisma.product.create({
    data: {
      name: "Inversor híbrido BYD + Battery-Box",
      description: "Sistema BYD híbrido con batería integrada.",
      internalCode: "INV-BYD-HYB",
      categoryId: cat("inversores-hibridos"),
      brandId: brand("BYD"),
      modelId: model("BYD", "Battery-Box HVS 5.1"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      primarySupplierId: supNac2.id,
      inverterType: "HYBRID",
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: invHy2.id,
      supplierId: supNac2.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const invHy3 = await prisma.product.create({
    data: {
      name: "Victron MultiPlus-II 48/5000",
      description: "Inversor/cargador híbrido 5 kW 48V.",
      internalCode: "INV-VIC-5K",
      categoryId: cat("inversores-hibridos"),
      brandId: brand("Victron"),
      modelId: model("Victron", "MultiPlus-II 48/5000"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      primarySupplierId: supNac1.id,
      inverterType: "HYBRID",
      nominalVoltageV: 48,
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: invHy3.id,
      supplierId: supNac1.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const bat1 = await prisma.product.create({
    data: {
      name: "BYD Battery-Box HVS 5.1",
      description: "Batería litio 5.1 kWh, alta tensión.",
      internalCode: "BAT-BYD-5.1",
      categoryId: cat("baterias"),
      brandId: brand("BYD"),
      modelId: model("BYD", "Battery-Box HVS 5.1"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "10 años",
      primarySupplierId: supNac2.id,
      isBatteryComponent: true,
    },
  });
  await prisma.productSupplier.createMany({
    data: [
      {
        productId: bat1.id,
        supplierId: supNac2.id,
        isPrimary: true,
        isAlternative: false,
      },
      {
        productId: bat1.id,
        supplierId: supInt3.id,
        isPrimary: false,
        isAlternative: true,
        leadTimeDays: 90,
      },
    ],
  });

  const bat2 = await prisma.product.create({
    data: {
      name: "BYD Battery-Box HVM 11.0",
      description: "Batería litio 11 kWh modular.",
      internalCode: "BAT-BYD-11",
      categoryId: cat("baterias"),
      brandId: brand("BYD"),
      modelId: model("BYD", "Battery-Box HVM 11.0"),
      unit: "unidad",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      warranty: "10 años",
      primarySupplierId: supInt3.id,
      isBatteryComponent: true,
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: bat2.id,
      supplierId: supInt3.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const est1 = await prisma.product.create({
    data: {
      name: "Estructura K2 D-Dome",
      description: "Estructura sobre cubierta tipo domo.",
      internalCode: "EST-K2-DDOME",
      categoryId: cat("estructuras"),
      brandId: brand("K2 Systems"),
      modelId: model("K2 Systems", "D-Dome"),
      unit: "juego",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      primarySupplierId: supNac1.id,
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: est1.id,
      supplierId: supNac1.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const est2 = await prisma.product.create({
    data: {
      name: "Estructura K2 TopFix",
      description: "Fijación para techo plano.",
      internalCode: "EST-K2-TOPFIX",
      categoryId: cat("estructuras"),
      brandId: brand("K2 Systems"),
      modelId: model("K2 Systems", "TopFix"),
      unit: "juego",
      defaultCurrency: "USD",
      commercialStatus: "ACTIVO",
      primarySupplierId: supNac1.id,
    },
  });
  await prisma.productSupplier.create({
    data: {
      productId: est2.id,
      supplierId: supNac1.id,
      isPrimary: true,
      isAlternative: false,
    },
  });

  const serv1 = await prisma.product.create({
    data: {
      name: "Ingeniería de diseño FV",
      description: "Proyecto de ingeniería y memorias.",
      internalCode: "SERV-ING",
      categoryId: cat("ingenieria"),
      unit: "proyecto",
      defaultCurrency: "CLP",
      commercialStatus: "ACTIVO",
    },
  });

  const serv2 = await prisma.product.create({
    data: {
      name: "Instalación y mano de obra",
      description: "Instalación completa sistema FV.",
      internalCode: "SERV-MO",
      categoryId: cat("mano-de-obra"),
      unit: "kWp",
      defaultCurrency: "CLP",
      commercialStatus: "ACTIVO",
    },
  });

  console.log("  Productos: 17 creados. Relaciones producto–proveedor asignadas.");

  const june2024 = new Date("2024-06-01T00:00:00.000Z");
  const july2024 = new Date("2024-07-01T00:00:00.000Z");
  const dec2024 = new Date("2024-12-31T23:59:59.999Z");
  const jan2025 = new Date("2025-01-01T00:00:00.000Z");

  await prisma.productPrice.create({
    data: {
      productId: panel1.id,
      supplierId: supNac1.id,
      price: 185,
      cost: 165,
      purchasePrice: 165,
      currency: "USD",
      validFrom: june2024,
      validTo: null,
      lastQuoteReceivedAt: june2024,
      suggestedMarginPercent: 12,
      supplierDiscountPercent: 5,
      logisticCostEstimate: 2.5,
      customsCostEstimate: null,
      totalLandedCost: 167.5,
      quoteReference: "Cotización Solar Chile 06/2024",
      validityIndicator: "Válido 30 días",
      internalCommercialNotes: "Precio nacional, stock Chile.",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: panel1.id,
      supplierId: supInt1.id,
      price: 172,
      cost: 148,
      purchasePrice: 148,
      currency: "USD",
      validFrom: july2024,
      validTo: null,
      lastQuoteReceivedAt: july2024,
      suggestedMarginPercent: 15,
      supplierDiscountPercent: 0,
      logisticCostEstimate: 8,
      customsCostEstimate: 6,
      totalLandedCost: 162,
      quoteReference: "Cotización Fábrica Longi 07/2024",
      validityIndicator: "Válido hasta fin de año",
      internalCommercialNotes: "Importación directa. MOQ contenedor.",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: invOn2.id,
      supplierId: supNac1.id,
      price: 820,
      cost: 720,
      purchasePrice: 720,
      currency: "USD",
      validFrom: new Date("2024-01-01T00:00:00.000Z"),
      validTo: dec2024,
      quoteReference: "Lista Fronius 2024",
      validityIndicator: "Reemplazado por lista 2025",
    },
  });
  await prisma.productPrice.create({
    data: {
      productId: invOn2.id,
      supplierId: supNac1.id,
      price: 850,
      cost: 745,
      purchasePrice: 745,
      currency: "USD",
      validFrom: jan2025,
      validTo: null,
      quoteReference: "Lista Fronius 2025",
      validityIndicator: "Vigente 2025",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: invOn1.id,
      supplierId: supInt2.id,
      price: 28500,
      cost: 24800,
      purchasePrice: 24800,
      currency: "USD",
      validFrom: july2024,
      validTo: null,
      logisticCostEstimate: 400,
      customsCostEstimate: 600,
      totalLandedCost: 25800,
      suggestedMarginPercent: 10,
      quoteReference: "Huawei Digital Power LATAM",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: bat1.id,
      supplierId: supNac2.id,
      price: 3200,
      cost: 2800,
      purchasePrice: 2800,
      currency: "USD",
      validFrom: june2024,
      validTo: null,
      logisticCostEstimate: 50,
      quoteReference: "Energía Solar Chile",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: serv1.id,
      price: 450000,
      currency: "CLP",
      validFrom: june2024,
      validTo: null,
      quoteReference: "Tarifa ingeniería 2024",
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: serv2.id,
      price: 85,
      currency: "USD",
      validFrom: june2024,
      validTo: null,
      quoteReference: "Tarifa instalación USD/kWp",
    },
  });

  console.log("  Historial de precios: 8 registros (nacional, internacional, cierre por vigencia).");
}

// ON_GRID: 6 ítems principales unificados para 3 kW, 4 kW y 6 kW. Textos comerciales consistentes.
const QUOTE_TEMPLATE_ITEMS_BASE = [
  {
    sortOrder: 1,
    itemType: "PANELES",
    quantityRule: "DERIVED_FROM_POWER",
    quantityFixed: null,
    potenciaPorPanelWp: 400,
    productNameSnapshot: "Suministro de paneles fotovoltaicos",
    productDescriptionSnapshot: "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
  },
  {
    sortOrder: 2,
    itemType: "INVERSOR",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Suministro de inversor",
    productDescriptionSnapshot: "Inversor on-grid para sistema de {{targetPowerKwp}} kW. Conexión a red.",
  },
  {
    sortOrder: 3,
    itemType: "ESTRUCTURA",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Estructura de montaje",
    productDescriptionSnapshot: "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
  },
  {
    sortOrder: 4,
    itemType: "INSTALACION",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Instalación y puesta en marcha",
    productDescriptionSnapshot: "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
  },
  {
    sortOrder: 5,
    itemType: "CANALIZACION",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Canalización",
    productDescriptionSnapshot: "Canalización y materiales eléctricos según especificación del proyecto.",
  },
  {
    sortOrder: 6,
    itemType: "INGENIERIA",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Ingeniería y documentación técnica",
    productDescriptionSnapshot: "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
  },
];

// OFF_GRID: 8 ítems — base (6) + Baterías + Protecciones/tablero. Textos comerciales diferenciados.
const QUOTE_TEMPLATE_ITEMS_OFF_GRID = [
  ...QUOTE_TEMPLATE_ITEMS_BASE.slice(0, 2).map((i, idx) =>
    idx === 1
      ? {
          ...i,
          productDescriptionSnapshot: "Inversor off-grid para sistema de {{targetPowerKwp}} kW. Sistema aislado con almacenamiento en baterías.",
        }
      : i,
  ),
  ...QUOTE_TEMPLATE_ITEMS_BASE.slice(2),
  {
    sortOrder: 7,
    itemType: "BATERIAS",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Baterías y almacenamiento",
    productDescriptionSnapshot: "Sistema de baterías para instalación off-grid. Incluye banco de baterías y gestión (BMS) según dimensionamiento.",
  },
  {
    sortOrder: 8,
    itemType: "PROTECCIONES_TABLERO",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Protecciones y tablero",
    productDescriptionSnapshot: "Protecciones eléctricas AC/DC y tablero de control para sistema off-grid. Incluye protecciones de batería e inversor.",
  },
];

// HYBRID: 8 ítems — base (6) + Baterías + Protecciones/tablero. Textos comerciales diferenciados.
const QUOTE_TEMPLATE_ITEMS_HYBRID = [
  ...QUOTE_TEMPLATE_ITEMS_BASE.slice(0, 2).map((i, idx) =>
    idx === 1
      ? {
          ...i,
          productDescriptionSnapshot: "Inversor híbrido para sistema de {{targetPowerKwp}} kW. Conexión a red con respaldo en baterías.",
        }
      : i,
  ),
  ...QUOTE_TEMPLATE_ITEMS_BASE.slice(2),
  {
    sortOrder: 7,
    itemType: "BATERIAS",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Baterías y almacenamiento",
    productDescriptionSnapshot: "Sistema de baterías para instalación híbrida. Respaldo y autoconsumo. Incluye banco y gestión (BMS) según dimensionamiento.",
  },
  {
    sortOrder: 8,
    itemType: "PROTECCIONES_TABLERO",
    quantityRule: "FIXED",
    quantityFixed: 1,
    potenciaPorPanelWp: null,
    productNameSnapshot: "Protecciones y tablero",
    productDescriptionSnapshot: "Protecciones eléctricas AC/DC y tablero de control para sistema híbrido. Incluye protecciones de batería, inversor y conexión a red.",
  },
];

async function seedQuoteTemplates() {
  // Normalización opcional: valores legacy → ON_GRID | OFF_GRID | HYBRID
  const rOnGrid = await prisma.quoteTemplate.updateMany({
    where: { systemType: "ONGRID" },
    data: { systemType: "ON_GRID" },
  });
  const rHybrid = await prisma.quoteTemplate.updateMany({
    where: { systemType: "HIBRIDO" },
    data: { systemType: "HYBRID" },
  });
  if (rOnGrid.count > 0 || rHybrid.count > 0) {
    console.log(
      `  Plantillas de cotización: normalizados systemType (ONGRID→ON_GRID: ${rOnGrid.count}, HIBRIDO→HYBRID: ${rHybrid.count}).`,
    );
  }

  const countBefore = await prisma.quoteTemplate.count();

  // ON_GRID: crear solo si no hay ninguna plantilla
  if (countBefore === 0) {
    const onGridTemplates = [
      { name: "3 kW OnGrid", targetPowerKwp: 3, sortOrder: 1 },
      { name: "4 kW OnGrid", targetPowerKwp: 4, sortOrder: 2 },
      { name: "6 kW OnGrid", targetPowerKwp: 6, sortOrder: 3 },
    ];
    const itemsPerOnGrid = QUOTE_TEMPLATE_ITEMS_BASE.length;
    for (const t of onGridTemplates) {
      const template = await prisma.quoteTemplate.create({
        data: {
          name: t.name,
          systemType: "ON_GRID",
          targetPowerKwp: t.targetPowerKwp,
          description: `Sistema fotovoltaico on-grid ${t.name}. Incluye paneles, inversor, estructura, instalación, canalización e ingeniería.`,
          active: true,
          sortOrder: t.sortOrder,
        },
      });
      for (const item of QUOTE_TEMPLATE_ITEMS_BASE) {
        await prisma.quoteTemplateItem.create({
          data: {
            quoteTemplateId: template.id,
            sortOrder: item.sortOrder,
            itemType: item.itemType,
            quantityRule: item.quantityRule,
            quantityFixed: item.quantityFixed,
            potenciaPorPanelWp: item.potenciaPorPanelWp,
            productNameSnapshot: item.productNameSnapshot,
            productDescriptionSnapshot: item.productDescriptionSnapshot,
            unitPriceDefault: 0,
          },
        });
      }
    }
    console.log(
      `  Plantillas de cotización: ${onGridTemplates.length} plantillas ON_GRID creadas, ${itemsPerOnGrid} ítems por plantilla.`,
    );
  } else {
    console.log(`  Plantillas de cotización: ya existen plantillas (${countBefore}). ON_GRID no se duplican.`);
  }

  // OFF_GRID: crear una plantilla si no existe ninguna con systemType OFF_GRID
  const offGridCount = await prisma.quoteTemplate.count({
    where: { systemType: "OFF_GRID" },
  });
  if (offGridCount === 0) {
    const template = await prisma.quoteTemplate.create({
      data: {
        name: "6 kW OffGrid",
        systemType: "OFF_GRID",
        targetPowerKwp: 6,
        description: "Sistema fotovoltaico off-grid 6 kW. Incluye paneles, inversor aislado, estructura, instalación, canalización, ingeniería, baterías y protecciones.",
        active: true,
        sortOrder: 10,
      },
    });
    for (const item of QUOTE_TEMPLATE_ITEMS_OFF_GRID) {
      await prisma.quoteTemplateItem.create({
        data: {
          quoteTemplateId: template.id,
          sortOrder: item.sortOrder,
          itemType: item.itemType,
          quantityRule: item.quantityRule,
          quantityFixed: item.quantityFixed,
          potenciaPorPanelWp: item.potenciaPorPanelWp,
          productNameSnapshot: item.productNameSnapshot,
          productDescriptionSnapshot: item.productDescriptionSnapshot,
          unitPriceDefault: 0,
        },
      });
    }
    console.log(
      `  Plantillas de cotización: 1 plantilla OFF_GRID creada (6 kW OffGrid), ${QUOTE_TEMPLATE_ITEMS_OFF_GRID.length} ítems.`,
    );
  }

  // HYBRID: crear una plantilla si no existe ninguna con systemType HYBRID
  const hybridCount = await prisma.quoteTemplate.count({
    where: { systemType: "HYBRID" },
  });
  if (hybridCount === 0) {
    const template = await prisma.quoteTemplate.create({
      data: {
        name: "5 kW Híbrido",
        systemType: "HYBRID",
        targetPowerKwp: 5,
        description: "Sistema fotovoltaico híbrido 5 kW. Incluye paneles, inversor híbrido, estructura, instalación, canalización, ingeniería, baterías y protecciones.",
        active: true,
        sortOrder: 11,
      },
    });
    for (const item of QUOTE_TEMPLATE_ITEMS_HYBRID) {
      await prisma.quoteTemplateItem.create({
        data: {
          quoteTemplateId: template.id,
          sortOrder: item.sortOrder,
          itemType: item.itemType,
          quantityRule: item.quantityRule,
          quantityFixed: item.quantityFixed,
          potenciaPorPanelWp: item.potenciaPorPanelWp,
          productNameSnapshot: item.productNameSnapshot,
          productDescriptionSnapshot: item.productDescriptionSnapshot,
          unitPriceDefault: 0,
        },
      });
    }
    console.log(
      `  Plantillas de cotización: 1 plantilla HYBRID creada (5 kW Híbrido), ${QUOTE_TEMPLATE_ITEMS_HYBRID.length} ítems.`,
    );
  }

  // T2: plantillas completas — precargar QuoteTemplateLine (MANUAL). ON_GRID: las 3 plantillas (3, 4, 6 kW); OFF_GRID y HYBRID: una cada una (idempotente).
  const templatesToFill = [
    { name: "3 kW OnGrid", label: "ON_GRID" },
    { name: "4 kW OnGrid", label: "ON_GRID" },
    { name: "6 kW OnGrid", label: "ON_GRID" },
    { name: "6 kW OffGrid", label: "OFF_GRID" },
    { name: "5 kW Híbrido", label: "HYBRID" },
  ];
  for (const { name: templateName, label } of templatesToFill) {
    const template = await prisma.quoteTemplate.findFirst({
      where: { name: templateName, active: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template || template.items.length === 0) continue;
    const itemIds = template.items.map((i) => i.id);
    const existingLines = await prisma.quoteTemplateLine.count({
      where: { quoteTemplateItemId: { in: itemIds } },
    });
    if (existingLines > 0) continue;

    for (let idx = 0; idx < template.items.length; idx++) {
      const item = template.items[idx];
      await prisma.quoteTemplateLine.create({
        data: {
          quoteTemplateItemId: item.id,
          sortOrder: idx,
          source: "MANUAL",
          productNameSnapshot: item.productNameSnapshot,
          productDescriptionSnapshot: item.productDescriptionSnapshot ?? null,
          quantityRule: item.quantityRule,
          quantityFixed: item.quantityFixed,
          potenciaPorPanelWp: item.potenciaPorPanelWp,
          unitPriceDefault: item.unitPriceDefault ?? 0,
          currency: null,
          visibleInFinalQuoteDefault: false,
        },
      });
    }
    console.log(
      `  Plantillas de cotización: ${templateName} (${label}) — ${template.items.length} líneas base precargadas.`,
    );
  }

  // Fase Q: normalizar textos comerciales OFF_GRID y HYBRID en plantillas existentes (idempotente).
  const offGridTemplate = await prisma.quoteTemplate.findFirst({
    where: { name: "6 kW OffGrid", active: true },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (offGridTemplate && offGridTemplate.items.length === QUOTE_TEMPLATE_ITEMS_OFF_GRID.length) {
    for (let i = 0; i < QUOTE_TEMPLATE_ITEMS_OFF_GRID.length; i++) {
      const def = QUOTE_TEMPLATE_ITEMS_OFF_GRID[i];
      const item = offGridTemplate.items[i];
      if (!item) continue;
      await prisma.quoteTemplateItem.update({
        where: { id: item.id },
        data: {
          productNameSnapshot: def.productNameSnapshot,
          productDescriptionSnapshot: def.productDescriptionSnapshot,
        },
      });
      if (item.lines && item.lines[0]) {
        await prisma.quoteTemplateLine.update({
          where: { id: item.lines[0].id },
          data: {
            productNameSnapshot: def.productNameSnapshot,
            productDescriptionSnapshot: def.productDescriptionSnapshot,
          },
        });
      }
    }
    console.log("  Plantillas de cotización: 6 kW OffGrid — textos comerciales actualizados.");
  }

  const hybridTemplate = await prisma.quoteTemplate.findFirst({
    where: { name: "5 kW Híbrido", active: true },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (hybridTemplate && hybridTemplate.items.length === QUOTE_TEMPLATE_ITEMS_HYBRID.length) {
    for (let i = 0; i < QUOTE_TEMPLATE_ITEMS_HYBRID.length; i++) {
      const def = QUOTE_TEMPLATE_ITEMS_HYBRID[i];
      const item = hybridTemplate.items[i];
      if (!item) continue;
      await prisma.quoteTemplateItem.update({
        where: { id: item.id },
        data: {
          productNameSnapshot: def.productNameSnapshot,
          productDescriptionSnapshot: def.productDescriptionSnapshot,
        },
      });
      if (item.lines && item.lines[0]) {
        await prisma.quoteTemplateLine.update({
          where: { id: item.lines[0].id },
          data: {
            productNameSnapshot: def.productNameSnapshot,
            productDescriptionSnapshot: def.productDescriptionSnapshot,
          },
        });
      }
    }
    console.log("  Plantillas de cotización: 5 kW Híbrido — textos comerciales actualizados.");
  }

  // R1: ON_GRID — líneas Paneles, Inversor y Estructura pasan a FROM_CATALOG con producto por defecto (idempotente).
  const catPaneles = await prisma.productCategory.findFirst({
    where: { slug: "paneles-fotovoltaicos" },
    select: { id: true },
  });
  const catInversoresOnGrid = await prisma.productCategory.findFirst({
    where: { slug: "inversores-on-grid" },
    select: { id: true },
  });
  const catEstructuras = await prisma.productCategory.findFirst({
    where: { slug: "estructuras" },
    select: { id: true },
  });
  const defaultPanel = catPaneles
    ? await prisma.product.findFirst({
        where: { categoryId: catPaneles.id, commercialStatus: "ACTIVO" },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;
  const defaultInverter = catInversoresOnGrid
    ? await prisma.product.findFirst({
        where: { categoryId: catInversoresOnGrid.id, commercialStatus: "ACTIVO" },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;
  const defaultStructure = catEstructuras
    ? await prisma.product.findFirst({
        where: { categoryId: catEstructuras.id, commercialStatus: "ACTIVO" },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;

  if (defaultPanel || defaultInverter || defaultStructure) {
    const onGridTemplates = await prisma.quoteTemplate.findMany({
      where: { systemType: "ON_GRID", active: true },
      include: { items: { orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } } },
    });
    let updated = 0;
    for (const template of onGridTemplates) {
      for (const item of template.items) {
        const productId =
          item.itemType === "PANELES"
            ? defaultPanel?.id ?? null
            : item.itemType === "INVERSOR"
              ? defaultInverter?.id ?? null
              : item.itemType === "ESTRUCTURA"
                ? defaultStructure?.id ?? null
                : null;
        if (!productId || !item.lines?.length) continue;
        const line = item.lines[0];
        await prisma.quoteTemplateLine.update({
          where: { id: line.id },
          data: { source: "FROM_CATALOG", productId },
        });
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`  Plantillas de cotización: R1 — ${updated} líneas ON_GRID pasadas a FROM_CATALOG (Paneles, Inversor, Estructura).`);
    }
  }

  // R2: OFF_GRID / HYBRID — líneas Paneles, Estructura, Baterías (y en HYBRID también Inversor) pasan a FROM_CATALOG (idempotente).
  const catInversoresHibridos = await prisma.productCategory.findFirst({
    where: { slug: "inversores-hibridos" },
    select: { id: true },
  });
  const catBaterias = await prisma.productCategory.findFirst({
    where: { slug: "baterias" },
    select: { id: true },
  });
  const defaultInverterHybrid = catInversoresHibridos
    ? await prisma.product.findFirst({
        where: { categoryId: catInversoresHibridos.id, commercialStatus: "ACTIVO" },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;
  const defaultBattery = catBaterias
    ? await prisma.product.findFirst({
        where: { categoryId: catBaterias.id, commercialStatus: "ACTIVO" },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;

  const offGridTemplates = await prisma.quoteTemplate.findMany({
    where: { systemType: "OFF_GRID", active: true },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } } },
  });
  let r2OffGridUpdated = 0;
  for (const template of offGridTemplates) {
    for (const item of template.items) {
      const productId =
        item.itemType === "PANELES"
          ? defaultPanel?.id ?? null
          : item.itemType === "ESTRUCTURA"
            ? defaultStructure?.id ?? null
            : item.itemType === "BATERIAS"
              ? defaultBattery?.id ?? null
              : null;
      if (!productId || !item.lines?.length) continue;
      const line = item.lines[0];
      await prisma.quoteTemplateLine.update({
        where: { id: line.id },
        data: { source: "FROM_CATALOG", productId },
      });
      r2OffGridUpdated++;
    }
  }

  const hybridTemplates = await prisma.quoteTemplate.findMany({
    where: { systemType: "HYBRID", active: true },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } } },
  });
  let r2HybridUpdated = 0;
  for (const template of hybridTemplates) {
    for (const item of template.items) {
      const productId =
        item.itemType === "PANELES"
          ? defaultPanel?.id ?? null
          : item.itemType === "INVERSOR"
            ? defaultInverterHybrid?.id ?? null
            : item.itemType === "ESTRUCTURA"
              ? defaultStructure?.id ?? null
              : item.itemType === "BATERIAS"
                ? defaultBattery?.id ?? null
                : null;
      if (!productId || !item.lines?.length) continue;
      const line = item.lines[0];
      await prisma.quoteTemplateLine.update({
        where: { id: line.id },
        data: { source: "FROM_CATALOG", productId },
      });
      r2HybridUpdated++;
    }
  }

  if (r2OffGridUpdated > 0 || r2HybridUpdated > 0) {
    console.log(
      `  Plantillas de cotización: R2 — OFF_GRID ${r2OffGridUpdated} líneas, HYBRID ${r2HybridUpdated} líneas pasadas a FROM_CATALOG.`,
    );
  }
}

const QUOTE_ADDON_RULES: Array<{
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  conditionType: string;
  thresholdNumeric: number | null;
  inputKey: string;
  quantityRule: string;
  unit: string;
  unitPriceDefault: number;
  currency: string;
  applicationMode: string;
}> = [
  {
    code: "CANALIZACION_EXCESO",
    name: "Canalización en exceso (sobre 20 m)",
    description: "Metros lineales de canalización adicional sobre 20 m incluidos.",
    sortOrder: 1,
    conditionType: "NUMERIC_GT",
    thresholdNumeric: 20,
    inputKey: "canalizacion_metros",
    quantityRule: "EXCESS",
    unit: "m",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "CABLE_EXCESO",
    name: "Cable en exceso (sobre 15 m)",
    description: "Metros de cable adicional sobre los 15 m incluidos en la oferta base.",
    sortOrder: 2,
    conditionType: "NUMERIC_GT",
    thresholdNumeric: 15,
    inputKey: "cable_metros",
    quantityRule: "EXCESS",
    unit: "m",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "MONTaje_ESPECIAL",
    name: "Montaje especial / estructura no estándar",
    description: "Una vez si el proyecto requiere montaje en techo plano, sobre piso o estructura no estándar.",
    sortOrder: 3,
    conditionType: "BOOLEAN",
    thresholdNumeric: 0,
    inputKey: "montaje_especial",
    quantityRule: "FIXED",
    unit: "unidad",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "PROTECCIONES_EXTRA",
    name: "Protecciones adicionales",
    description: "Una vez si se requieren protecciones AC/DC adicionales al estándar.",
    sortOrder: 4,
    conditionType: "BOOLEAN",
    thresholdNumeric: 0,
    inputKey: "protecciones_extra",
    quantityRule: "FIXED",
    unit: "unidad",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "TRASLADO_KM",
    name: "Traslado (por km sobre 30 km)",
    description: "Kilómetros de traslado que exceden los 30 km incluidos.",
    sortOrder: 5,
    conditionType: "NUMERIC_GT",
    thresholdNumeric: 30,
    inputKey: "traslado_km",
    quantityRule: "EXCESS",
    unit: "km",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "ZANJA_METROS",
    name: "Zanja o canalización enterrada",
    description: "Metros lineales de zanja o canalización enterrada.",
    sortOrder: 6,
    conditionType: "NUMERIC_GTE",
    thresholdNumeric: 1,
    inputKey: "zanja_metros",
    quantityRule: "VALUE",
    unit: "m",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
  {
    code: "INGENIERIA_EXTRA",
    name: "Ingeniería adicional",
    description: "Una vez si se solicita ingeniería de detalle o revisión adicional.",
    sortOrder: 7,
    conditionType: "BOOLEAN",
    thresholdNumeric: 0,
    inputKey: "ingenieria_extra",
    quantityRule: "FIXED",
    unit: "unidad",
    unitPriceDefault: 0,
    currency: "CLP",
    applicationMode: "SUGERIDO",
  },
];

async function seedQuoteAddOns() {
  let created = 0;
  for (const rule of QUOTE_ADDON_RULES) {
    const existing = await prisma.quoteAddOn.findUnique({ where: { code: rule.code } });
    if (existing) continue;
    await prisma.quoteAddOn.create({
      data: {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        active: true,
        sortOrder: rule.sortOrder,
        conditionType: rule.conditionType,
        thresholdNumeric: rule.thresholdNumeric ?? 0,
        inputKey: rule.inputKey,
        quantityRule: rule.quantityRule,
        unit: rule.unit,
        unitPriceDefault: rule.unitPriceDefault,
        currency: rule.currency,
        applicationMode: rule.applicationMode,
      },
    });
    created++;
  }
  if (created > 0) {
    console.log(`  Adicionales automáticos: ${created} regla(s) creada(s) (SUGERIDO).`);
  } else {
    console.log("  Adicionales automáticos: todas las reglas ya existen.");
  }
}

/** Código de activación por defecto para desarrollo/pruebas (ej. DEMO-ACTIVATE-001). */
async function seedActivationCodes() {
  const code = "DEMO-ACTIVATE-001";
  const existing = await prisma.activationCode.findUnique({ where: { code } });
  if (!existing) {
    await prisma.activationCode.create({
      data: { code, maxActivations: 10 },
    });
    console.log("  Código de activación de prueba creado:", code, "(máx. 10 instalaciones)");
  } else {
    console.log("  Código de activación ya existe.");
  }
}

/**
 * Plantilla base MARGIN persistida, alineada con filterBlocksForApplyClean(ON_GRID, STANDARD).
 * Idempotente: si ya existe quoteKind MARGIN + nombre fijo, no hace nada.
 */
async function seedMarginBaseQuoteTemplate() {
  const existing = await prisma.quoteTemplate.findFirst({
    where: { quoteKind: "MARGIN", name: MARGIN_BASE_QUOTE_TEMPLATE_NAME },
  });
  if (existing) {
    console.log(`  Plantilla MARGIN base: ya existe "${MARGIN_BASE_QUOTE_TEMPLATE_NAME}" (idempotente).`);
    return;
  }

  const blocks = filterBlocksForApplyClean("ON_GRID", "STANDARD");
  const maxSort = await prisma.quoteTemplate.aggregate({ _max: { sortOrder: true } });
  const sortOrder = Math.max((maxSort._max.sortOrder ?? -1) + 1, 100);

  await prisma.$transaction(async (tx) => {
    const template = await tx.quoteTemplate.create({
      data: {
        name: MARGIN_BASE_QUOTE_TEMPLATE_NAME,
        quoteKind: "MARGIN",
        systemType: "ON_GRID",
        targetPowerKwp: 4,
        description: MARGIN_BASE_QUOTE_TEMPLATE_DESCRIPTION,
        active: true,
        sortOrder,
      },
    });

    for (const block of blocks) {
      const item = await tx.quoteTemplateItem.create({
        data: {
          quoteTemplateId: template.id,
          sortOrder: block.sortOrder,
          itemType: "OTRO",
          quantityRule: "FIXED",
          quantityFixed: 1,
          potenciaPorPanelWp: null,
          productNameSnapshot: block.name,
          productDescriptionSnapshot: block.description ?? null,
          unitPriceDefault: 0,
        },
      });

      for (const line of block.lines) {
        await tx.quoteTemplateLine.create({
          data: {
            quoteTemplateItemId: item.id,
            sortOrder: line.sortOrder,
            source: "MANUAL",
            productNameSnapshot: line.productNameSnapshot,
            productDescriptionSnapshot: line.productDescriptionSnapshot ?? null,
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            unitPriceDefault: 0,
            currency: null,
            visibleInFinalQuoteDefault: false,
          },
        });
      }
    }
  });

  console.log(
    `  Plantilla MARGIN base: creada "${MARGIN_BASE_QUOTE_TEMPLATE_NAME}" (${blocks.length} bloques, líneas sin valorizar).`,
  );
}

async function main() {
  const minimal = process.env.EMBEDDED_PORTABLE_MINIMAL_SEED === "1";
  console.log("Ejecutando seed..." + (minimal ? " [portable mínimo]" : ""));
  await seedRolesAndAdmin();
  await seedActivationCodes();
  // Clientes de prueba no se crean por defecto; base limpia para uso desde cero. Use clean:test-data y cree clientes desde la app.
  await seedCatalog();
  if (minimal) {
    console.log("  Plantillas / MARGIN / adicionales: omitidos (portable mínimo).");
  } else {
    await seedQuoteTemplates();
    await seedMarginBaseQuoteTemplate();
    await seedQuoteAddOns();
  }
  if (!minimal && process.env.SKIP_MEJORA_CSO_SEED !== "1") {
    const { runMejoraCsoDemoSeed } = await import("./seed-mejora-demo-project-core");
    await runMejoraCsoDemoSeed(prisma);
  } else if (minimal) {
    console.log("  Demo CSO: omitido (portable mínimo).");
  } else {
    console.log("  Demo CSO: omitido (SKIP_MEJORA_CSO_SEED=1).");
  }
  console.log("Seed finalizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
