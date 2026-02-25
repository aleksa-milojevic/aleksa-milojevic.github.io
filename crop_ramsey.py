from PIL import Image

# Open the original image
img = Image.open('Ramsey_thumbnail.png')

# Calculate cropping box for central 60% horizontally and vertically
width, height = img.size
left = int(width * 0.2)
right = int(width * 0.8)
top = int(height * 0.2)
bottom = int(height * 0.8)

cropped = img.crop((left, top, right, bottom))
cropped.save('Ramsey_thumbnail_cropped.png')
print('Cropped image saved as Ramsey_thumbnail_cropped.png')
