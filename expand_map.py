import json

# Read the current map
map_path = r'c:\Users\Intersession\Documents\test-goody\maps\level1.tmj'
with open(map_path, 'r') as f:
    map_json = json.load(f)

# Get current dimensions
old_width = map_json['width']
height = map_json['height']
old_tile_count = len(map_json['data'])
new_width = 400  # Expand to 400 tiles wide

print(f"Old map: {old_width} x {height} = {old_tile_count} tiles")
print(f"New map: {new_width} x {height} = {new_width * height} tiles")

# Create new tile array
new_data = list(map_json['data'])

# Generate new tiles for extended sections
new_tiles_needed = (new_width * height) - old_tile_count
new_tiles = [0] * new_tiles_needed

# Add platforms throughout the new section
# Bottom row stays solid (ground tiles)
for row in range(height):
    for col in range(old_width, new_width):
        index = row * new_width + col
        new_index = index - old_tile_count
        
        # Bottom row is always ground
        if row == height - 1:
            new_tiles[new_index] = 1
        # Add platforms at various heights
        elif row == 15 and col % 30 < 10:
            new_tiles[new_index] = 1
        elif row == 10 and col % 40 < 8:
            new_tiles[new_index] = 1
        elif row == 20 and col % 35 < 12:
            new_tiles[new_index] = 1

# Combine arrays
all_tiles = new_data + new_tiles

# Update the map JSON
map_json['width'] = new_width
map_json['data'] = all_tiles

# Save the modified map
with open(map_path, 'w') as f:
    json.dump(map_json, f, indent=1)

print(f"Map expanded and saved! New size: {len(all_tiles)} tiles")
