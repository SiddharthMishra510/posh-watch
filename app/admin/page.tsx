import { AdminApp } from "@/components/admin/AdminApp";
import { PLATFORM_PUBLIC_KEY } from "@/lib/site";

export default function AdminPage() {
  return <AdminApp publicKey={PLATFORM_PUBLIC_KEY} />;
}
