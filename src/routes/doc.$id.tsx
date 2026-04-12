import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { eq } from "@tanstack/db"
import { documentsCollection } from "@/db/collections/documents"
import { useState, useEffect, useRef } from "react"
import { YjsProvider } from "@durable-streams/y-durable-streams"
import * as Y from "yjs"
import { Awareness } from "y-protocols/awareness"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { absoluteApiUrl } from "@/lib/client-url"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, Users } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/doc/$id")({
	ssr: false,
	component: DocPage,
})

const CURSOR_COLORS = [
	"#d0bcff", "#ff8c3b", "#75fbfd", "#f85149", "#9ecbff",
	"#d29922", "#7ee787", "#f778ba", "#a5d6ff", "#ffa657",
]

const ANIMAL_NAMES = [
	"Penguin", "Otter", "Fox", "Owl", "Dolphin",
	"Panda", "Koala", "Falcon", "Tiger", "Wolf",
]

function getOrCreateIdentity(): { name: string; color: string } {
	let name = localStorage.getItem("collab-user-name")
	let color = localStorage.getItem("collab-user-color")
	if (!name || !color) {
		const num = Math.floor(Math.random() * 100)
		name = `${ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)]} #${num}`
		color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
		localStorage.setItem("collab-user-name", name)
		localStorage.setItem("collab-user-color", color)
	}
	return { name, color }
}

function DocPage() {
	const { id } = Route.useParams()
	return <CollabEditor key={id} docId={id} />
}

function CollabEditor({ docId }: { docId: string }) {
	const navigate = useNavigate()
	const identity = useRef(getOrCreateIdentity()).current

	const { data: docs } = useLiveQuery(
		(q) => q.from({ doc: documentsCollection }).where(({ doc }) => eq(doc.id, docId)),
		[docId],
	)
	const doc = docs?.[0]

	const [editingTitle, setEditingTitle] = useState(false)
	const [titleValue, setTitleValue] = useState("")
	const titleInputRef = useRef<HTMLInputElement>(null)

	const [ydoc] = useState(() => new Y.Doc())
	const [awareness] = useState(() => {
		const aw = new Awareness(ydoc)
		aw.setLocalStateField("user", {
			name: identity.name,
			color: identity.color,
		})
		return aw
	})
	const [provider] = useState(
		() =>
			new YjsProvider({
				doc: ydoc,
				baseUrl: absoluteApiUrl("/api/yjs"),
				docId,
				awareness,
			}),
	)

	useEffect(() => {
		return () => {
			provider.destroy()
			awareness.destroy()
			ydoc.destroy()
		}
	}, [provider, awareness, ydoc])

	const [synced, setSynced] = useState(false)
	useEffect(() => {
		const handler = (s: boolean) => {
			if (s) setSynced(true)
		}
		provider.on("synced", handler)
		const errorHandler = (err: Error) => {
			toast.error(`Connection error: ${err.message}`)
		}
		provider.on("error", errorHandler)
		return () => {
			provider.off("synced", handler)
			provider.off("error", errorHandler)
		}
	}, [provider])

	const [peers, setPeers] = useState<Array<{ name: string; color: string }>>([])
	useEffect(() => {
		const update = () => {
			const states = awareness.getStates()
			const users: Array<{ name: string; color: string }> = []
			states.forEach((state, clientId) => {
				if (clientId !== ydoc.clientID && state.user) {
					users.push(state.user)
				}
			})
			setPeers(users)
		}
		awareness.on("change", update)
		return () => awareness.off("change", update)
	}, [awareness, ydoc.clientID])

	const editor = useEditor({
		extensions: [
			StarterKit.configure({ undoRedo: false }),
			Collaboration.configure({ document: ydoc }),
			CollaborationCaret.configure({
				provider,
				user: {
					name: identity.name,
					color: identity.color,
				},
			}),
		],
		editorProps: {
			attributes: {
				class: "prose prose-invert max-w-none min-h-[60vh] focus:outline-none px-6 py-4",
			},
		},
	})

	const handleTitleEdit = () => {
		setTitleValue(doc?.title ?? "Untitled")
		setEditingTitle(true)
		setTimeout(() => titleInputRef.current?.focus(), 0)
	}

	const handleTitleSave = () => {
		setEditingTitle(false)
		if (doc && titleValue.trim() && titleValue !== doc.title) {
			documentsCollection.update(doc.id, (draft) => {
				draft.title = titleValue.trim()
				draft.updated_at = new Date()
			})
		}
	}

	return (
		<div className="min-h-screen flex flex-col bg-[#1b1b1f]">
			<header className="h-14 border-b border-[#2a2c34] sticky top-0 bg-[#161618]/80 backdrop-blur-sm z-10">
				<div className="container mx-auto max-w-5xl px-4 h-full flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: "/" })}
						className="text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4 mr-1" />
						Back
					</Button>

					<Separator orientation="vertical" className="h-6" />

					{editingTitle ? (
						<Input
							ref={titleInputRef}
							value={titleValue}
							onChange={(e) => setTitleValue(e.target.value)}
							onBlur={handleTitleSave}
							onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
							className="h-8 max-w-xs bg-[#2a2a32] border-[#3c3f44] text-sm font-medium"
						/>
					) : (
						<button
							onClick={handleTitleEdit}
							className="text-sm font-medium hover:text-[#d0bcff] transition-colors duration-150 truncate max-w-xs"
						>
							{doc?.title ?? "Untitled"}
						</button>
					)}

					<div className="ml-auto flex items-center gap-2">
						<TooltipProvider>
							<div className="flex items-center gap-1">
								{peers.map((peer, i) => (
									<Tooltip key={i}>
										<TooltipTrigger>
											<div
												className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-[#1b1b1f]"
												style={{ backgroundColor: peer.color }}
											>
												{peer.name.charAt(0).toUpperCase()}
											</div>
										</TooltipTrigger>
										<TooltipContent>{peer.name}</TooltipContent>
									</Tooltip>
								))}
								<div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
									<Users className="h-3.5 w-3.5" />
									<span>{peers.length + 1}</span>
								</div>
							</div>
						</TooltipProvider>
					</div>
				</div>
			</header>

			<main className="flex-1 overflow-auto">
				<div className="container mx-auto max-w-3xl py-8">
					{!synced ? (
						<div className="flex items-center justify-center h-[60vh] text-muted-foreground">
							Connecting...
						</div>
					) : (
						<div className="bg-[#202127] rounded-xl border border-[#2a2c34] min-h-[70vh]">
							<EditorContent editor={editor} />
						</div>
					)}
				</div>
			</main>
		</div>
	)
}
