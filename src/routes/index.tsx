import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { documentsCollection } from "@/db/collections/documents"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, FileText } from "lucide-react"
import { formatDistanceToNow } from "@/lib/time"

export const Route = createFileRoute("/")({
	ssr: false,
	component: DocumentList,
})

function DocumentList() {
	const navigate = useNavigate()
	const { data: documents, isLoading } = useLiveQuery((q) =>
		q.from({ doc: documentsCollection }).orderBy(({ doc }) => doc.updated_at, "desc"),
	)

	const handleCreate = async () => {
		const id = crypto.randomUUID()
		documentsCollection.insert({
			id,
			title: "Untitled",
			created_at: new Date(),
			updated_at: new Date(),
		})
		navigate({ to: "/doc/$id", params: { id } })
	}

	return (
		<div className="min-h-screen flex flex-col">
			<header className="h-14 border-b border-[#2a2c34] sticky top-0 bg-[#161618]/80 backdrop-blur-sm z-10">
				<div className="container mx-auto max-w-5xl px-4 h-full flex items-center justify-between">
					<div className="flex items-center gap-2">
						<svg className="h-5 w-5" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
							<path d="M106.992 16.1244C107.711 15.4029 108.683 15 109.692 15H170L84.0082 101.089C83.2888 101.811 82.3171 102.213 81.3081 102.213H21L106.992 16.1244Z" fill="#d0bcff" />
							<path d="M96.4157 104.125C96.4157 103.066 97.2752 102.204 98.331 102.204H170L96.4157 176V104.125Z" fill="#d0bcff" />
						</svg>
						<h1 className="text-lg font-medium">Collab Editor</h1>
					</div>
					<Button onClick={handleCreate} className="bg-[#d0bcff] text-[#1b1b1f] hover:bg-[#c4aef5]">
						<Plus className="h-4 w-4 mr-1" />
						New Document
					</Button>
				</div>
			</header>

			<main className="flex-1 overflow-auto">
				<div className="container mx-auto max-w-5xl px-4 py-8">
					<h2 className="text-xl font-semibold mb-6">Documents</h2>

					{isLoading ? (
						<div className="grid gap-3">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-16 rounded-xl" />
							))}
						</div>
					) : documents.length === 0 ? (
						<Card className="border-[#2a2c34] bg-[#202127] p-12 text-center rounded-xl">
							<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground mb-4">No documents yet. Create your first one.</p>
							<Button onClick={handleCreate} className="bg-[#d0bcff] text-[#1b1b1f] hover:bg-[#c4aef5]">
								<Plus className="h-4 w-4 mr-1" />
								New Document
							</Button>
						</Card>
					) : (
						<div className="grid gap-3">
							{documents.map((doc) => (
								<Card
									key={doc.id}
									className="border-[#2a2c34] bg-[#202127] hover:border-[#d0bcff]/30 transition-colors duration-150 cursor-pointer rounded-xl"
									onClick={() => navigate({ to: "/doc/$id", params: { id: doc.id } })}
								>
									<div className="p-4 flex items-center justify-between">
										<div className="flex items-center gap-3">
											<FileText className="h-5 w-5 text-[#d0bcff]" />
											<span className="font-medium">{doc.title}</span>
										</div>
										<span className="text-xs text-muted-foreground">
											{formatDistanceToNow(doc.updated_at)}
										</span>
									</div>
								</Card>
							))}
						</div>
					)}
				</div>
			</main>

			<footer className="border-t border-[#2a2c34] py-6 mt-auto">
				<div className="container mx-auto max-w-5xl px-4 flex items-center justify-between text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<svg className="h-4 w-4" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
							<path d="M106.992 16.1244C107.711 15.4029 108.683 15 109.692 15H170L84.0082 101.089C83.2888 101.811 82.3171 102.213 81.3081 102.213H21L106.992 16.1244Z" fill="#d0bcff" />
							<path d="M96.4157 104.125C96.4157 103.066 97.2752 102.204 98.331 102.204H170L96.4157 176V104.125Z" fill="#d0bcff" />
						</svg>
						<span>Built with <a href="https://electric-sql.com" target="_blank" rel="noopener noreferrer" className="text-[#d0bcff] hover:underline">Electric</a></span>
					</div>
					<span>&copy; {new Date().getFullYear()} Electric SQL</span>
				</div>
			</footer>
		</div>
	)
}
