// app/projects/edit/[mangaId]/page.tsx
import EditMangaForm from "./edit-manga-form";

interface EditMangaPageProps {
  params: Promise<{ mangaId: string }>;
}

export default async function EditMangaPage(props: EditMangaPageProps) {
  const { mangaId } = await props.params;

  return <EditMangaForm mangaId={mangaId} />;
}