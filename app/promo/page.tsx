// app/promo/page.tsx
import PromoDashboard from "./promo-dashboard";

export const metadata = {
  title: "Промо код",
  description: "Промо код үүсгэх, ашиглалтын статистик харах",
};

export default function PromoPage() {
  return <PromoDashboard />;
}