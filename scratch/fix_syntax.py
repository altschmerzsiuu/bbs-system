with open('src/app/(admin)/admin/schedule/[slotId]/AdminSessionDetailClient.tsx', 'r') as f:
    content = f.read()

content = content.replace("    }\n}\n}", "    }\n}")
content = content.replace("    };\n\n    const handleConfirmNoShow = () => {", "    }\n\n    const handleConfirmNoShow = () => {")

with open('src/app/(admin)/admin/schedule/[slotId]/AdminSessionDetailClient.tsx', 'w') as f:
    f.write(content)
