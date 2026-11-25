import { HourglassMediumIcon } from "@phosphor-icons/react/dist/ssr";

import { AuthNotice } from "@/components/layout/auth-notice";
import { withLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function PendingAccessPage() {
  const { locale, t } = await getDictionary();
  return (
    <AuthNotice
      icon={<HourglassMediumIcon weight="duotone" className="size-8" />}
      title={t.register.pendingTitle}
      backHref={withLocale(locale, "/login")}
      backLabel={t.register.backToSignIn}
    >
      <p>{t.register.pendingBody}</p>
    </AuthNotice>
  );
}
