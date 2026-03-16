

import "./contentView.css";
import QuizBlock from "../Quiz/QuizBlock";

export default function ContentView({ 
  courseTitle,
  section,
  moduleTitle,
  moduleIndex,
  onNext,
  onPrev,
  isFirstSection,
  isLastSection,
  progressPercentage,
  markComplete,
  isComplete,
  orderMandatory
}) {
  if (!section) {
    return (
      <main className="content-view">
        <h1 className="course-title">{moduleTitle}</h1>
        <p className="section-content">No section selected.</p>
      </main>
    );
  }


  
  return (
    <main className="content-view">
      <h1 className="course-title">{moduleTitle}</h1>
      {/* New Module Header */}
      {
        <h3 className="progress-percentage">
          {Math.round(progressPercentage)}% complete
        </h3>
      }

      {/* Section Title With Decimal */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Section Title With Decimal */}
      <h2 className="section-title">
        {section.displayNumber} {section.title}
      </h2>
      <div className="section-content">
        {Array.isArray(section.content)
          ? section.content.map((block, idx) => renderContentBlock(block, idx))
          : <p>{section.content}</p> /* fallback for old data */}
</div>

      <div className="section-nav">
        <div className="nav-button-wrapper">
          <button
            className="nav-button"
            onClick={onPrev}
            disabled={isFirstSection}
          >
            Previous
          </button>
        </div>
        <div className="nav-button-wrapper">
          <button
            className="nav-button"
            onClick={markComplete}
            disabled={isComplete}
          >
            Complete
          </button>
          <button
            className="nav-button"
            onClick={onNext}
            disabled={isLastSection || (orderMandatory && !isComplete)}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
  
}

// AI generated function to render content blocks
function renderContentBlock(item, key) {
  switch (item.type) {
    case "text":
      return (
        <p key={key}>
          {item.value}
        </p>
        )

    case "video":
      return (
        <div key={key} className="video-wrapper">
          <iframe
            width="560"
            height="315"
            src={item.url}
            title="Video content"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
      
    case "quiz":
    return (
      <QuizBlock
        key={key}
        data={item}
        name={`quiz-${key}`}
      />
    );
      
      case "game":
        return (
          <div key={key} className="game-block">
            <p><strong>Game:</strong> {item.name || "Unnamed game"}</p>
            {item.description && <p>{item.description}</p>}
          </div>
        );
      
      default:
        return <p key={key}>Unknown content type</p>;
  }
}