import { connectDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

type Rule = {
  search: string;
  replace: string;
  caseSensitive: boolean;
  fields: string[];
};

function applyRules(text: string, rules: Rule[]): string {
  let result = text;
  for (const rule of rules) {
    try {
      const flags = rule.caseSensitive ? "g" : "gi";
      const regex = new RegExp(rule.search, flags);
      result = result.replace(regex, rule.replace);
    } catch {
      // invalid regex — skip
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { rules, dryRun } = await req.json();
    const activeRules: Rule[] = (rules || []).filter((r: Rule) => r.search?.trim());
    if (!activeRules.length) return NextResponse.json({ error: "No rules" }, { status: 400 });

    const db = await connectDB();
    const products = await db.collection("products").find({}).toArray();
    let updated = 0, skipped = 0, errors = 0;

    for (const product of products) {
      try {
        const patch: Record<string, string> = {};
        let changed = false;

        for (const rule of activeRules) {
          for (const field of rule.fields) {
            const original = product[field];
            if (typeof original !== "string") continue;
            const replaced = applyRules(original, [rule]);
            if (replaced !== original) {
              patch[field] = replaced;
              changed = true;
            }
          }
        }

        if (!changed) { skipped++; continue; }
        if (!dryRun) {
          await db.collection("products").updateOne(
            { _id: product._id },
            { $set: patch }
          );
        }
        updated++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ total: products.length, updated, skipped, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
