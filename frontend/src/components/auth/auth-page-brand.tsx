import Image from "next/image";
import Link from "next/link";

export function AuthPageBrand() {
  return (
    <div className="flex justify-center">
      <Link
        href="/"
        aria-label="Routy 홈으로 이동"
        className="group inline-flex items-center justify-center rounded-2xl p-1 text-center"
      >
        <Image
          src="/logo.svg"
          alt="Routy 로고"
          width={84}
          height={84}
          priority
          className="h-[72px] w-[72px] rounded-[18px] shadow-surface ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-[1.02] md:h-[84px] md:w-[84px] md:rounded-[22px]"
        />
      </Link>
    </div>
  );
}
