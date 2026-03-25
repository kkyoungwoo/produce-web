import type { ReactNode } from "react";

import Footer from "@/components/footer";
import Header from "@/components/header";
import PageFx from "@/components/page-fx";

type SiteFrameProps = {
  children: ReactNode;
};

export default function SiteFrame({ children }: SiteFrameProps) {
  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      <Header />
      <PageFx />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
