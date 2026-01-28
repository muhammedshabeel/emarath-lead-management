import { PrismaClient, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const admin = await prisma.staff.upsert({
    where: { email: 'admin@emarath.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@emarath.com',
      role: StaffRole.ADMIN,
      country: 'UAE',
      active: true,
    },
  });
  console.log('✅ Created admin:', admin.email);

  // Create sample agents
  const agent1 = await prisma.staff.upsert({
    where: { email: 'agent1@emarath.com' },
    update: {},
    create: {
      name: 'Sales Agent 1',
      email: 'agent1@emarath.com',
      role: StaffRole.AGENT,
      country: 'UAE',
      active: true,
      cx3Extension: '101',
    },
  });
  console.log('✅ Created agent:', agent1.email);

  const agent2 = await prisma.staff.upsert({
    where: { email: 'agent2@emarath.com' },
    update: {},
    create: {
      name: 'Sales Agent 2',
      email: 'agent2@emarath.com',
      role: StaffRole.AGENT,
      country: 'KSA',
      active: true,
      cx3Extension: '102',
    },
  });
  console.log('✅ Created agent:', agent2.email);

  // Create CS staff
  const cs = await prisma.staff.upsert({
    where: { email: 'cs@emarath.com' },
    update: {},
    create: {
      name: 'Customer Service',
      email: 'cs@emarath.com',
      role: StaffRole.CS,
      country: 'UAE',
      active: true,
    },
  });
  console.log('✅ Created CS staff:', cs.email);

  // Create Delivery staff
  const delivery = await prisma.staff.upsert({
    where: { email: 'delivery@emarath.com' },
    update: {},
    create: {
      name: 'Delivery Staff',
      email: 'delivery@emarath.com',
      role: StaffRole.DELIVERY,
      country: 'UAE',
      active: true,
    },
  });
  console.log('✅ Created delivery staff:', delivery.email);

  // Create sample products
  const products = [
    { productCode: 'PRD001', productName: 'Oud Perfume 50ml' },
    { productCode: 'PRD002', productName: 'Musk Perfume 50ml' },
    { productCode: 'PRD003', productName: 'Rose Perfume 50ml' },
    { productCode: 'PRD004', productName: 'Amber Perfume 100ml' },
    { productCode: 'PRD005', productName: 'Signature Collection Set' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { productCode: product.productCode },
      update: {},
      create: product,
    });
  }
  console.log('✅ Created products');

  // Create EM Series settings
  const emSeries = [
    { country: 'UAE', prefix: 'EM-UAE-', nextCounter: 1 },
    { country: 'KSA', prefix: 'EM-KSA-', nextCounter: 1 },
    { country: 'KWT', prefix: 'EM-KWT-', nextCounter: 1 },
    { country: 'BHR', prefix: 'EM-BHR-', nextCounter: 1 },
    { country: 'OMN', prefix: 'EM-OMN-', nextCounter: 1 },
    { country: 'QAT', prefix: 'EM-QAT-', nextCounter: 1 },
  ];

  for (const series of emSeries) {
    await prisma.settingsEmSeries.upsert({
      where: { country: series.country },
      update: {},
      create: series,
    });
  }
  console.log('✅ Created EM Series settings');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
