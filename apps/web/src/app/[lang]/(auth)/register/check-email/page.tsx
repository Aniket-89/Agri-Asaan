import { EnvelopeSimpleOpenIcon } from "@phosphor-icons/react/dist/ssr";

import { AuthNotice } from "@/components/layout/auth-notice";
import { withLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function CheckEmailPage() {
  const { locale, t } = await getDictionary();
  return (
    <AuthNotice
      icon={<EnvelopeSimpleOpenIcon weight="duotone" className="size-8" />}
      title={t.register.checkEmailTitle}
      backHref={withLocale(locale, "/login")}
      backLabel={t.register.backToSignIn}
    >
      <p>{t.register.checkEmailBody}</p>
      <p>{t.register.checkEmailNext}</p>
    </AuthNotice>
  );
}
