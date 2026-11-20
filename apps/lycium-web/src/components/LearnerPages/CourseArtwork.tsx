import Image from "next/image";
import type { CourseEntry } from "../../courseTypes";
import learningWorld from "../../assets/learning-world.webp";
import computing from "../../assets/computing.webp";
import humanities from "../../assets/humanities.webp";
import finance from "../../assets/finance.webp";
import engineering from "../../assets/engineering.webp";
import chemistry from "../../assets/chemistry.webp";
import { getCourseArtworkId } from "../../utils/courseArtwork";

const artwork = { learning: learningWorld, computing, humanities, finance, engineering, chemistry };

export default function CourseArtwork({ course, className = "" }: {
  course: CourseEntry;
  className?: string;
}) {
  const image = artwork[getCourseArtworkId(course)];
  return (
    <div className={`course-artwork ${className}`} aria-hidden="true">
      <Image src={image} alt="" sizes="(max-width: 700px) 100vw, 400px" />
    </div>
  );
}
