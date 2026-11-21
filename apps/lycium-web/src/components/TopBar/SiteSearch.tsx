import { Search } from "lucide-react";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";

const basePath = (process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium").replace(/\/$/, "");

export default function SiteSearch() {
  return (
    <form className="site-search" role="search" aria-label="Site search" action={`${basePath}${COURSE_CATALOG_PATH}`} method="get">
      <input type="search" name="q" aria-label="Search all courses" placeholder="What do you want to learn?" />
      <button type="submit" aria-label="Submit course search" title="Search courses"><Search size={19} aria-hidden="true" /></button>
    </form>
  );
}
