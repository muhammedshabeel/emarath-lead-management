/**
 * Emarath CRM - Airtable CSV Import Script
 * 
 * Usage:
 *   npx ts-node scripts/import-csv.ts --type=staff --file=./data/staff.csv
 *   npx ts-node scripts/import-csv.ts --type=products --file=./data/products.csv
 *   npx ts-node scripts/import-csv.ts --type=customers --file=./data/customers.csv
 *   npx ts-node scripts/import-csv.ts --type=leads --file=./data/leads.csv
 *   npx ts-node scripts/import-csv.ts --type=orders --file=./data/orders.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Phone normalization
function normalizePhoneKey(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/\s+/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    if (cleaned.match(/^(971|966|965|973|968|974)/)) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+971' + cleaned.replace(/^0+/, '');
    }
  }
  return cleaned;
}

// Simple CSV parser
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Import functions for each type
async function importStaff(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const email = row.email || row.Email || row.EMAIL;
      if (!email) {
        result.skipped++;
        continue;
      }
      
      await prisma.staff.upsert({
        where: { email },
        create: {
          email,
          name: row.name || row.Name || email.split('@')[0],
          role: (row.role || row.Role || 'AGENT').toUpperCase() as any,
          country: row.country || row.Country || null,
          cx3Extension: row.extension || row['3cx_extension'] || null,
          active: (row.active || row.Active || 'true').toLowerCase() === 'true',
        },
        update: {
          name: row.name || row.Name,
          role: (row.role || row.Role || 'AGENT').toUpperCase() as any,
          country: row.country || row.Country || null,
          cx3Extension: row.extension || row['3cx_extension'] || null,
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importProducts(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const productCode = row.product_code || row.code || row.Code || row.ProductCode;
      if (!productCode) {
        result.skipped++;
        continue;
      }
      
      await prisma.product.upsert({
        where: { productCode },
        create: {
          productCode,
          productName: row.product_name || row.name || row.Name || productCode,
          active: (row.active || row.Active || 'true').toLowerCase() === 'true',
        },
        update: {
          productName: row.product_name || row.name || row.Name || productCode,
          active: (row.active || row.Active || 'true').toLowerCase() === 'true',
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importCustomers(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const phone = row.phone || row.Phone || row.phone_1 || row.Phone1;
      const phoneKey = normalizePhoneKey(phone);
      
      if (!phoneKey) {
        result.skipped++;
        continue;
      }
      
      await prisma.customer.upsert({
        where: { phoneKey },
        create: {
          phoneKey,
          phone1: phone,
          phone2: row.phone_2 || row.Phone2 || null,
          name: row.name || row.Name || null,
          country: row.country || row.Country || null,
          city: row.city || row.City || null,
          address1: row.address || row.Address || row.address_1 || null,
          address2: row.address_2 || null,
        },
        update: {
          name: row.name || row.Name || undefined,
          phone2: row.phone_2 || row.Phone2 || undefined,
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importLeads(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const phone = row.phone || row.Phone || row.phone_key;
      const phoneKey = normalizePhoneKey(phone);
      
      if (!phoneKey) {
        result.skipped++;
        continue;
      }
      
      // Find or create customer
      let customer = await prisma.customer.findUnique({ where: { phoneKey } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { phoneKey, phone1: phone, name: row.customer_name || null },
        });
      }
      
      // Find agent by email/name
      let agentId: string | null = null;
      const agentRef = row.agent || row.Agent || row.assigned_agent;
      if (agentRef) {
        const agent = await prisma.staff.findFirst({
          where: {
            OR: [
              { email: agentRef },
              { name: { contains: agentRef } },
            ],
          },
        });
        agentId = agent?.id || null;
      }
      
      await prisma.lead.create({
        data: {
          phoneKey,
          customerId: customer.id,
          leadDate: row.lead_date ? new Date(row.lead_date) : new Date(),
          status: (row.status || row.Status || 'NEW').toUpperCase().replace(' ', '_') as any,
          country: row.country || row.Country || null,
          source: row.source || row.Source || null,
          adSource: row.ad_source || null,
          language: row.language || row.Language || null,
          notes: row.notes || row.Notes || null,
          assignedAgentId: agentId,
          paymentMethod: row.payment_method || null,
          csRemarks: row.cs_remarks || null,
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importOrders(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const orderKey = row.order_key || row.OrderKey || row.order_id || `ORD-${Date.now()}-${result.imported}`;
      
      // Find customer
      const phone = row.phone || row.Phone || row.customer_phone;
      const phoneKey = normalizePhoneKey(phone);
      let customer = phoneKey ? await prisma.customer.findUnique({ where: { phoneKey } }) : null;
      
      if (!customer && phoneKey) {
        customer = await prisma.customer.create({
          data: { phoneKey, phone1: phone, name: row.customer_name || null },
        });
      }
      
      // Find sales staff
      let salesStaffId: string | null = null;
      const salesRef = row.sales_staff || row.agent;
      if (salesRef) {
        const staff = await prisma.staff.findFirst({
          where: { OR: [{ email: salesRef }, { name: { contains: salesRef } }] },
        });
        salesStaffId = staff?.id || null;
      }
      
      await prisma.order.upsert({
        where: { orderKey },
        create: {
          orderKey,
          orderDate: row.order_date ? new Date(row.order_date) : new Date(),
          country: row.country || row.Country || null,
          emNumber: row.em_number || row.EMNumber || null,
          orderStatus: (row.order_status || row.status || 'ONGOING').toUpperCase() as any,
          trackingNumber: row.tracking_number || null,
          rto: (row.rto || 'false').toLowerCase() === 'true',
          value: row.value ? parseFloat(row.value) : null,
          paymentMethod: row.payment_method || null,
          notes: row.notes || null,
          cancellationReason: row.cancellation_reason || null,
          customerId: customer?.id || null,
          salesStaffId,
        },
        update: {
          orderStatus: (row.order_status || row.status || 'ONGOING').toUpperCase() as any,
          trackingNumber: row.tracking_number || undefined,
          value: row.value ? parseFloat(row.value) : undefined,
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importEmSeries(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  
  for (const row of rows) {
    try {
      const country = row.country || row.Country;
      if (!country) {
        result.skipped++;
        continue;
      }
      
      await prisma.settingsEmSeries.upsert({
        where: { country },
        create: {
          country,
          prefix: row.prefix || row.Prefix || `EM${country}`,
          nextCounter: parseInt(row.next_counter || row.counter || '1') || 1,
          active: (row.active || 'true').toLowerCase() === 'true',
        },
        update: {
          prefix: row.prefix || row.Prefix,
          nextCounter: parseInt(row.next_counter || row.counter || '1') || 1,
        },
      });
      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row ${result.imported + result.skipped + 1}: ${error.message}`);
    }
  }
  
  return result;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find(a => a.startsWith('--type='));
  const fileArg = args.find(a => a.startsWith('--file='));
  
  if (!typeArg || !fileArg) {
    console.log('Usage: npx ts-node scripts/import-csv.ts --type=<type> --file=<path>');
    console.log('Types: staff, products, customers, leads, orders, em-series');
    process.exit(1);
  }
  
  const type = typeArg.split('=')[1];
  const filePath = fileArg.split('=')[1];
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`Importing ${type} from ${filePath}...`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`Parsed ${rows.length} rows`);
  
  let result: ImportResult;
  
  switch (type) {
    case 'staff':
      result = await importStaff(rows);
      break;
    case 'products':
      result = await importProducts(rows);
      break;
    case 'customers':
      result = await importCustomers(rows);
      break;
    case 'leads':
      result = await importLeads(rows);
      break;
    case 'orders':
      result = await importOrders(rows);
      break;
    case 'em-series':
      result = await importEmSeries(rows);
      break;
    default:
      console.error(`Unknown type: ${type}`);
      process.exit(1);
  }
  
  console.log(`\nImport complete:`);
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Skipped: ${result.skipped}`);
  
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    const rejectPath = filePath.replace('.csv', '-rejects.txt');
    fs.writeFileSync(rejectPath, result.errors.join('\n'));
    console.log(`  Rejects written to: ${rejectPath}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
