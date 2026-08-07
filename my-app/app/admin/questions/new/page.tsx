import { principles, topics } from "@/lib/admin/fixtures";
import { QuestionEditor } from "./editor";

export default function NewQuestionPage() {
  return (
    <QuestionEditor
      topics={topics}
      principles={principles.map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.descriptor,
      }))}
    />
  );
}
