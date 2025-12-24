
// ######################===== UPDATE FEATURE NEWS CODE =====#########################################

// Function to replace LEFT article content
function replaceLeftArticle(newData) {
  const article = document.querySelector('.Article.LEFT');

  if (!article) {
    console.error('Left article not found');
    return;
  }

  const img = article.querySelector('.img');
  if (img && newData.image) {
    img.src = newData.image;
    img.alt = newData.imageAlt || 'img';
  }

  const heading = article.querySelector('h3');
  if (heading && newData.title) {
    heading.textContent = newData.title;
  }

  const date = article.querySelector('.date');
  if (date && newData.date) {
    date.textContent = newData.date;
  }

  const description = article.querySelector('.info p:not(.date)');
  if (description && newData.description) {
    description.textContent = newData.description;
  }
}

// Function to replace RIGHT article content
function replaceRightArticle(newData) {
  const article = document.querySelector('.Article.RIGHT');

  if (!article) {
    console.error('Right article not found');
    return;
  }

  const img = article.querySelector('.img');
  if (img && newData.image) {
    img.src = newData.image;
    img.alt = newData.imageAlt || 'img';
  }

  const heading = article.querySelector('h3');
  if (heading && newData.title) {
    heading.textContent = newData.title;
  }

  const date = article.querySelector('.date');
  if (date && newData.date) {
    date.textContent = newData.date;
  }

  const description = article.querySelector('.info p:not(.date)');
  if (description && newData.description) {
    description.textContent = newData.description;
  }
}

// Function to parse CSV - handles the exact format from your file
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const data = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split only first 3 commas for image,date,title then rest is description
    const parts = [];
    let currentPart = '';
    let commaCount = 0;

    for (let j = 0; j < line.length; j++) {
      if (line[j] === ',' && commaCount < 3) {
        parts.push(currentPart.trim());
        currentPart = '';
        commaCount++;
      } else {
        currentPart += line[j];
      }
    }
    // Add the last part (description)
    parts.push(currentPart.trim());

    if (parts.length >= 4) {
      const row = {
        image: parts[0],
        date: parts[1],
        title: parts[2],
        description: parts[3]
      };
      data.push(row);
    }
  }

  return data;
}

// Main function to load CSV and update articles
async function updateArticlesFromCSV() {
  try {
    const response = await fetch('../Article/feature.csv');
    const csvText = await response.text();
    const data = parseCSV(csvText);

    if (data.length < 2) {
      console.error('CSV must contain at least 2 data rows');
      return;
    }

    // Get last two rows
    const lastRow = data[data.length - 1];
    const secondLastRow = data[data.length - 2];

    // Update LEFT article with last row
    replaceLeftArticle({
      image: lastRow.image,
      title: lastRow.title.toUpperCase(),
      date: lastRow.date,
      description: lastRow.description
    });

    // Update RIGHT article with second last row
    replaceRightArticle({
      image: secondLastRow.image,
      title: secondLastRow.title.toUpperCase(),
      date: secondLastRow.date,
      description: secondLastRow.description
    });

    console.log('Articles updated successfully!');
  } catch (error) {
    console.error('Error loading CSV:', error);
  }
}

// Call the function when page loads
document.addEventListener('DOMContentLoaded', updateArticlesFromCSV);






